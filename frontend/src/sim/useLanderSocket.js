import { useState, useEffect, useRef, useCallback } from 'react';
import { ClientPhysics } from './clientPhysics';
import { GameMode } from './constants';

export function useLanderSocket() {
  const [connectionMode, setConnectionMode] = useState('connecting'); // 'online' | 'standalone' | 'connecting'
  const [state, setState] = useState(() => new ClientPhysics(GameMode.HARD).getState());
  
  const clientPhysicsRef = useRef(new ClientPhysics(GameMode.HARD));
  const wsRef = useRef(null);
  const actionRef = useRef(0);
  const modeRef = useRef(GameMode.HARD);
  const isOnlineRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);

  // Set action
  const sendAction = useCallback((action) => {
    actionRef.current = action;
    if (isOnlineRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'action', action }));
    }
  }, []);

  // Reset simulation
  const reset = useCallback(() => {
    actionRef.current = 0;
    if (isOnlineRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reset' }));
    } else {
      clientPhysicsRef.current.reset();
      setState(clientPhysicsRef.current.getState());
    }
  }, []);

  // Toggle Pause
  const togglePause = useCallback(() => {
    if (isOnlineRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'toggle_pause' }));
    } else {
      clientPhysicsRef.current.togglePause();
      setState(clientPhysicsRef.current.getState());
    }
  }, []);

  // Set Mode (Easy / Hard)
  const setMode = useCallback((newMode) => {
    modeRef.current = newMode;
    if (isOnlineRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_mode', mode: newMode }));
    } else {
      clientPhysicsRef.current.setMode(newMode);
      setState(clientPhysicsRef.current.getState());
    }
  }, []);

  // Download Telemetry CSV
  const downloadTelemetryCsv = useCallback(async () => {
    if (isOnlineRef.current) {
      try {
        const res = await fetch('/api/telemetry.csv');
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'telemetry.csv';
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
      } catch (err) {
        console.warn('Could not fetch server telemetry, falling back to local history:', err);
      }
    }

    // Fallback: Generate CSV from client physics
    const history = clientPhysicsRef.current.telemetryHistory;
    const headers = [
      'Time stamp',
      'Fuel Consumed (%)',
      'Vertical Velocity (m/s)',
      'Horizontal Vel (m/s)',
      'Altitude (m)',
      'Tilt Angle (deg)',
      'Range to Pad (m)',
      'Mode',
      'Result',
    ];
    const rows = history.map((r) => [
      r.timestamp,
      r.fuel_consumed,
      r.vertical_velocity,
      r.horizontal_velocity,
      r.altitude,
      r.tilt_angle,
      r.range_to_pad,
      r.mode,
      r.result,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Standalone physics animation loop
  useEffect(() => {
    let animId;
    let lastTime = performance.now();

    const loop = (currentTime) => {
      // If we are not online, run local simulation at ~60 Hz
      if (!isOnlineRef.current) {
        const elapsed = (currentTime - lastTime) / 1000;
        if (elapsed >= 1 / 65) {
          lastTime = currentTime;
          const nextState = clientPhysicsRef.current.step(actionRef.current);
          setState({ ...nextState });
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // WebSocket Connection Management
  useEffect(() => {
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // If in dev port 5173, Vite proxies /ws to 8000, or directly ws://localhost:8000/ws
      const host = window.location.port === '5173' ? 'localhost:8000' : window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      let socket;
      try {
        socket = new WebSocket(wsUrl);
      } catch (err) {
        setConnectionMode('standalone');
        isOnlineRef.current = false;
        scheduleReconnect();
        return;
      }

      wsRef.current = socket;

      socket.onopen = () => {
        if (unmounted) return;
        setConnectionMode('online');
        isOnlineRef.current = true;
      };

      socket.onmessage = (event) => {
        if (unmounted) return;
        try {
          const parsed = JSON.parse(event.data);
          setState(parsed);
          modeRef.current = parsed.mode;
        } catch (err) {
          console.error('Failed to parse WS state:', err);
        }
      };

      socket.onerror = () => {
        // Will trigger onclose
      };

      socket.onclose = () => {
        if (unmounted) return;
        isOnlineRef.current = false;
        setConnectionMode('standalone');
        // Synchronize local physics state with latest received state
        clientPhysicsRef.current.setMode(modeRef.current);
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connect, 3500);
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    state,
    connectionMode,
    sendAction,
    reset,
    togglePause,
    setMode,
    downloadTelemetryCsv,
  };
}
