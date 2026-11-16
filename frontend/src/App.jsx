import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  });

  const [gameState, setGameState] = useState({
    altitude: 500,
    pos_x: -300,
    range_to_pad: 300,
    vertical_velocity: 0,
    horizontal_velocity: 0,
    tilt_angle: 0,
    fuel_consumed: 0,
    elapsed_time: 0,
    is_terminal: false,
    landing_success: false,
    status_message: 'Connecting to Gymnasium...',
    mode: 'Easy',
    gravity: 1.62,
    last_action: 0,
    is_paused: false,
    is_autopilot: false,
    sink_rate: 0,
    max_sink_rate: 3.0,
    max_tilt_angle: 25.0,
  });

  const keysPressed = useRef({
    up: false,
    left: false,
    right: false,
  });

  // Track window resizing
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Connect WebSocket to FastAPI backend
  useEffect(() => {
    let ws;
    let reconnectTimer;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const state = JSON.parse(event.data);
          setGameState(state);
        } catch (err) {
          console.error('Failed to parse WebSocket message', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 1500);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  const sendAction = (actionCode) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'action', action: actionCode }));
    }
  };

  const sendCommand = (type, payload = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    }
  };

  const updateActionFromKeys = () => {
    let action = 0;
    if (keysPressed.current.up) {
      action = 1; // Thrust
    } else if (keysPressed.current.left) {
      action = 2; // Pitch Left
    } else if (keysPressed.current.right) {
      action = 3; // Pitch Right
    }
    sendAction(action);
  };

  // Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        keysPressed.current.up = true;
        updateActionFromKeys();
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        keysPressed.current.left = true;
        updateActionFromKeys();
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        keysPressed.current.right = true;
        updateActionFromKeys();
      } else if (e.code === 'Space') {
        e.preventDefault();
        sendCommand('toggle_pause');
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        sendCommand('reset');
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        const nextMode = gameState.mode === 'Hard' ? 'Easy' : 'Hard';
        sendCommand('set_mode', { mode: nextMode });
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        sendCommand('toggle_autopilot');
      }
    };

    const handleKeyUp = (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        keysPressed.current.up = false;
        updateActionFromKeys();
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        keysPressed.current.left = false;
        updateActionFromKeys();
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        keysPressed.current.right = false;
        updateActionFromKeys();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState.mode]);

  // Canvas Vector Wireframe Rendering (Atari 2D Style matching reference image)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const groundY = height - 40;

    // 1. Clear Screen
    ctx.fillStyle = '#111315';
    ctx.fillRect(0, 0, width, height);

    // 2. Pad & Flags Geometry
    const centerX = width / 2;
    const scaleY = (groundY - 140) / 550.0;

    // Pad Width: Generously sized landing pad between flags
    const padWidthPx = isPortrait
      ? Math.max(150, Math.min(width * 0.44, 220))
      : Math.max(180, (gameState.pad_width || 100.0) * ((width * 0.72) / 700.0));

    const leftFlagX = centerX - padWidthPx / 2;
    const rightFlagX = centerX + padWidthPx / 2;

    // Clean Ground Line (Atari wireframe)
    ctx.strokeStyle = '#272a31';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Pad Landing Surface Line
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftFlagX, groundY);
    ctx.lineTo(rightFlagX, groundY);
    ctx.stroke();

    // Atari Wireframe Flag matching reference image
    const drawFlag = (fx, fy) => {
      ctx.save();
      ctx.strokeStyle = '#dce1e8';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Vertical Flag Pole
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy - 65);
      ctx.stroke();

      // Flag Pennant
      ctx.beginPath();
      ctx.moveTo(fx, fy - 65);
      ctx.bezierCurveTo(fx + 10, fy - 67, fx + 22, fy - 63, fx + 34, fy - 65);
      ctx.lineTo(fx + 34, fy - 40);
      ctx.bezierCurveTo(fx + 22, fy - 38, fx + 10, fy - 42, fx, fy - 40);
      ctx.stroke();

      ctx.restore();
    };

    drawFlag(leftFlagX, groundY);
    drawFlag(rightFlagX, groundY);

    // 3. Draw 2D Atari Lunar Lander (Exact design from reference image)
    const rawPosX = gameState.pos_x !== undefined
      ? gameState.pos_x
      : (gameState.range_to_pad ? -Math.abs(gameState.range_to_pad) : -300);

    const desktopScaleX = (width * 0.72) / 700.0;
    const responsiveTravelSpan = centerX - 65;
    const landerX = isPortrait
      ? centerX + (rawPosX / 300.0) * responsiveTravelSpan
      : centerX + rawPosX * desktopScaleX;

    // Footpads rest exactly on groundY at alt = 0
    const landerY = groundY - (gameState.altitude * scaleY) - 26;

    ctx.save();
    ctx.translate(landerX, landerY);
    ctx.rotate((gameState.tilt_angle * Math.PI) / 180);

    ctx.strokeStyle = '#dce1e8';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // A. Top Hexagonal Capsule with horizontal slit `[-]`
    ctx.beginPath();
    ctx.moveTo(-16, -26);
    ctx.lineTo(16, -26);
    ctx.lineTo(24, -14);
    ctx.lineTo(16, -2);
    ctx.lineTo(-16, -2);
    ctx.lineTo(-24, -14);
    ctx.closePath();
    ctx.stroke();

    // Center Slit `[-]` inside capsule
    ctx.beginPath();
    ctx.moveTo(-8, -14);
    ctx.lineTo(8, -14);
    ctx.stroke();

    // B. Descent Stage: Horizontal Base Rectangle
    ctx.beginPath();
    ctx.rect(-22, -2, 44, 12);
    ctx.stroke();

    // C. Left Leg & Footpad
    ctx.beginPath();
    ctx.moveTo(-16, 10);
    ctx.lineTo(-30, 26);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-36, 26);
    ctx.lineTo(-24, 26);
    ctx.stroke();

    // D. Right Leg & Footpad
    ctx.beginPath();
    ctx.moveTo(16, 10);
    ctx.lineTo(30, 26);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(24, 26);
    ctx.lineTo(36, 26);
    ctx.stroke();

    // Thruster Vector Flame
    const hasFuel = gameState.fuel_consumed < 100;
    if (gameState.last_action === 1 && hasFuel) {
      const flicker = Math.random() * 8;
      ctx.beginPath();
      ctx.moveTo(-8, 10);
      ctx.lineTo(0, 30 + flicker);
      ctx.lineTo(8, 10);
      ctx.stroke();
    }

    // Left RCS Steering Plume
    if (gameState.last_action === 2 && hasFuel) {
      ctx.beginPath();
      ctx.moveTo(-24, -8);
      ctx.lineTo(-34, -8);
      ctx.lineTo(-24, -5);
      ctx.stroke();
    }

    // Right RCS Steering Plume
    if (gameState.last_action === 3 && hasFuel) {
      ctx.beginPath();
      ctx.moveTo(24, -8);
      ctx.lineTo(34, -8);
      ctx.lineTo(24, -5);
      ctx.stroke();
    }

    ctx.restore();

    // 4. Mission Result Banner
    if (gameState.is_terminal) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px -apple-system, sans-serif';
      ctx.fillStyle = gameState.landing_success ? '#4ade80' : '#f87171';
      ctx.fillText(
        gameState.landing_success ? 'LANDING SUCCESSFUL' : 'MISSION FAILED: CRASH',
        width / 2,
        height / 2 - 20
      );

      ctx.font = '14px -apple-system, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(gameState.status_message, width / 2, height / 2 + 10);

      ctx.font = '13px monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('Press [R] to Restart | [M] to Toggle Mode', width / 2, height / 2 + 35);
      ctx.restore();
    }

    // 5. Paused Overlay
    if (gameState.is_paused) {
      ctx.save();
      ctx.fillStyle = 'rgba(17, 19, 21, 0.7)';
      ctx.fillRect(0, 0, width, height);

      ctx.textAlign = 'center';
      ctx.font = 'bold 26px -apple-system, sans-serif';
      ctx.fillStyle = '#dce1e8';
      ctx.fillText('PAUSED', width / 2, height / 2 - 10);

      ctx.font = '13px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Press [Spacebar] to Resume', width / 2, height / 2 + 20);
      ctx.restore();
    }
  }, [gameState, windowDimensions]);

  const formatTimeStr = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}s`;
  };

  const isPortrait = windowDimensions.width < 768;
  const fuelRemainingPct = Math.max(0, Math.min(100, 100 - gameState.fuel_consumed));
  const altRatioPct = Math.max(0, Math.min(100, (gameState.altitude / 500) * 100));
  const rangeDisplay = Math.round(Math.abs(gameState.range_to_pad));

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#111315',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* =========================================================================
          TOP HUD (Matching Reference Image)
         ========================================================================= */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: isPortrait ? '12px 14px' : '16px 28px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}>
        {/* --- LANE 1 --- */}
        <div style={{
          display: 'flex',
          justifyContent: isPortrait ? 'space-between' : 'center',
          alignItems: 'center',
          width: '100%',
          position: isPortrait ? 'static' : 'relative',
          pointerEvents: 'auto',
        }}>
          {/* In Landscape: Left cluster */}
          {!isPortrait && (
            <div style={{ position: 'absolute', left: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
              <div
                className="telemetry-pill clickable-pill"
                onClick={() => {
                  const next = gameState.mode === 'Easy' ? 'Hard' : 'Easy';
                  sendCommand('set_mode', { mode: next });
                }}
                title={gameState.mode === 'Easy'
                  ? 'Easy Mode: Moon Gravity (1.62 m/s²), Generous Fuel, Relaxed Limits (Click to toggle to Hard [M])'
                  : 'Hard Mode: Moon Gravity (1.62 m/s²), Default Fuel, Strict Limits (Click to toggle to Easy [M])'}
              >
                Mode: {gameState.mode}
              </div>
              <div className="telemetry-pill">
                Range: {rangeDisplay}m
              </div>
              <div className="telemetry-pill">
                Tilt: {Math.round(gameState.tilt_angle)} Deg
              </div>
            </div>
          )}

          {/* Time Badge (Centered) */}
          <div className="telemetry-pill" style={{ margin: isPortrait ? '0 auto' : '0' }}>
            Time: {formatTimeStr(gameState.elapsed_time)}
          </div>

          {/* In Landscape: Right cluster */}
          {!isPortrait && (
            <div style={{ position: 'absolute', right: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="telemetry-pill">
                Sink Rate: {Math.round(gameState.sink_rate)}m/s
              </div>
              <div className="telemetry-pill">
                Horizontal Vel: {Math.round(Math.abs(gameState.horizontal_velocity))}m/s
              </div>
              <div
                className="telemetry-pill clickable-pill"
                onClick={() => sendCommand('reset')}
                title="Restart flight [R]"
                style={{ fontSize: 12, padding: '6px 10px', color: '#94a3b8' }}
              >
                ↺ [R]
              </div>
              <a
                href="/api/telemetry.csv"
                download="telemetry.csv"
                className="telemetry-pill clickable-pill"
                style={{ fontSize: 12, padding: '6px 10px', color: '#94a3b8', textDecoration: 'none' }}
                title="Download 1 Hz telemetry.csv"
              >
                CSV
              </a>
            </div>
          )}

          {/* In Portrait: Quick utility icons on right of Lane 1 */}
          {isPortrait && (
            <div style={{ display: 'flex', gap: 6, position: 'absolute', right: 14 }}>
              <div
                className="telemetry-pill clickable-pill"
                onClick={() => sendCommand('reset')}
                title="Restart [R]"
                style={{ fontSize: 11, padding: '5px 8px' }}
              >
                ↺
              </div>
              <a
                href="/api/telemetry.csv"
                download="telemetry.csv"
                className="telemetry-pill clickable-pill"
                style={{ fontSize: 11, padding: '5px 8px', textDecoration: 'none' }}
                title="CSV"
              >
                CSV
              </a>
            </div>
          )}
        </div>

        {/* --- LANE 2: Responsive Second Lane (Portrait / narrow screens) --- */}
        {isPortrait && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            width: '100%',
            pointerEvents: 'auto',
          }}>
            {/* Left Stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <div className="telemetry-pill" style={{ fontSize: 12, padding: '5px 10px' }}>
                Sink Rate: {Math.round(gameState.sink_rate)}m/s
              </div>
              <div className="telemetry-pill" style={{ fontSize: 12, padding: '5px 10px' }}>
                Hor Vel: {Math.round(Math.abs(gameState.horizontal_velocity))}m/s
              </div>
            </div>

            {/* Right Stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <div className="telemetry-pill" style={{ fontSize: 12, padding: '5px 10px' }}>
                Range: {rangeDisplay}m
              </div>
              <div
                className="telemetry-pill clickable-pill"
                onClick={() => {
                  const next = gameState.mode === 'Easy' ? 'Hard' : 'Easy';
                  sendCommand('set_mode', { mode: next });
                }}
                style={{ fontSize: 12, padding: '5px 10px' }}
              >
                Mode: {gameState.mode}
              </div>
              <div className="telemetry-pill" style={{ fontSize: 12, padding: '5px 10px' }}>
                Tilt: {Math.round(gameState.tilt_angle)} Deg
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          VERTICAL CAPSULE GAUGES (Alt & Fuel)
         ========================================================================= */}
      <div style={{
        position: 'absolute',
        top: isPortrait ? 150 : 130,
        right: isPortrait ? 16 : 36,
        display: 'flex',
        gap: 14,
        zIndex: 5,
        pointerEvents: 'none',
      }}>
        {/* Altitude Vertical Capsule */}
        <div className="vertical-gauge-container">
          <span className="vertical-gauge-label">Alt</span>
          <div className="vertical-gauge-track">
            <div
              className="vertical-gauge-fill"
              style={{ height: `${altRatioPct}%` }}
            />
          </div>
        </div>

        {/* Fuel Vertical Capsule */}
        <div className="vertical-gauge-container">
          <span className="vertical-gauge-label">Fuel</span>
          <div className="vertical-gauge-track">
            <div
              className="vertical-gauge-fill"
              style={{ height: `${fuelRemainingPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN 2D ATARI VECTOR CANVAS
         ========================================================================= */}
      <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={windowDimensions.width}
          height={windowDimensions.height}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>

      {/* =========================================================================
          BOTTOM ON-SCREEN / TOUCH CONTROLS (Small & Unobtrusive)
         ========================================================================= */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        zIndex: 10,
      }}>
        <button
          onMouseDown={() => sendAction(2)}
          onMouseUp={() => sendAction(0)}
          onTouchStart={() => sendAction(2)}
          onTouchEnd={() => sendAction(0)}
          className="touch-btn"
          title="Tilt Left [A or ←]"
        >
          ◀
        </button>

        <button
          onMouseDown={() => sendAction(1)}
          onMouseUp={() => sendAction(0)}
          onTouchStart={() => sendAction(1)}
          onTouchEnd={() => sendAction(0)}
          className="touch-btn touch-btn-thrust"
          title="Thrust [W or ↑]"
        >
          ▲ Thrust
        </button>

        <button
          onMouseDown={() => sendAction(3)}
          onMouseUp={() => sendAction(0)}
          onTouchStart={() => sendAction(3)}
          onTouchEnd={() => sendAction(0)}
          className="touch-btn"
          title="Tilt Right [D or →]"
        >
          ▶
        </button>

        <button
          onClick={() => sendCommand('toggle_pause')}
          className="touch-btn"
          title="Pause / Resume [Space]"
          style={{ padding: '4px 8px', opacity: 0.8 }}
        >
          {gameState.is_paused ? '▶' : '⏸'}
        </button>
      </div>
    </div>
  );
}
