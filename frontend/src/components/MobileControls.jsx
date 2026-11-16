import React, { useState, useEffect } from 'react';

export default function MobileControls({
  sendAction,
  reset,
  togglePause,
  onToggleMode,
  mode,
  isPaused,
  cameraMode,
  setCameraMode,
  activeAction,
  fuelDepleted,
}) {
  const [activeButton, setActiveButton] = useState(null);

  // Trigger action with touch feedback
  const handlePress = (actionId, buttonName, e) => {
    if (e && e.cancelable) e.preventDefault();
    if (fuelDepleted && actionId !== 0) return;
    setActiveButton(buttonName);
    sendAction(actionId);
  };

  const handleRelease = (e) => {
    if (e && e.cancelable) e.preventDefault();
    setActiveButton(null);
    sendAction(0);
  };

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return;
      if (['ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        sendAction(1);
        setActiveButton('thrust');
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        sendAction(2);
        setActiveButton('left');
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        sendAction(3);
        setActiveButton('right');
      } else if (e.code === 'Space') {
        togglePause();
      } else if (e.code === 'KeyR') {
        reset();
      } else if (e.code === 'KeyM') {
        onToggleMode();
      }
    };

    const handleKeyUp = (e) => {
      if (['ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) {
        sendAction(0);
        setActiveButton(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [sendAction, reset, togglePause, onToggleMode]);

  const cycleCamera = () => {
    const modes = ['chase', 'pad', 'free'];
    const nextIdx = (modes.indexOf(cameraMode) + 1) % modes.length;
    setCameraMode(modes[nextIdx]);
  };

  return (
    <div className="mobile-controls-bar">
      {/* Top Quick Utility Action Strip */}
      <div className="controls-utility-strip">
        <button
          className={`util-pill ${isPaused ? 'active' : ''}`}
          onClick={togglePause}
          title="Pause / Resume Flight [Spacebar]"
        >
          {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
        </button>

        <button className="util-pill" onClick={reset} title="Reset Simulation [R]">
          ↺ RESET
        </button>

        <button className="util-pill cam-pill" onClick={cycleCamera} title="Cycle Camera Angle">
          🎥 CAM: {cameraMode.toUpperCase()}
        </button>

        <button
          className={`util-pill mode-pill ${mode === 'Hard' ? 'mode-hard' : 'mode-easy'}`}
          onClick={onToggleMode}
          title="Toggle Easy/Hard Mode [M]"
        >
          MODE: {mode.toUpperCase()}
        </button>
      </div>

      {/* Main Touch Controls: Left and Right Wings */}
      <div className="touch-pad-container">
        {/* Left Hand: Pitch Lateral Thrusters */}
        <div className="touch-group left-group">
          <button
            className={`touch-btn pitch-btn ${activeButton === 'left' ? 'pressed' : ''}`}
            onTouchStart={(e) => handlePress(2, 'left', e)}
            onTouchEnd={handleRelease}
            onMouseDown={(e) => handlePress(2, 'left', e)}
            onMouseUp={handleRelease}
            onMouseLeave={handleRelease}
            disabled={fuelDepleted}
            title="Pitch Left [A / ←]"
          >
            <span className="btn-icon">◀</span>
            <span className="btn-subtext">PITCH LEFT</span>
            <span className="key-hint">A / ←</span>
          </button>

          <button
            className={`touch-btn pitch-btn ${activeButton === 'right' ? 'pressed' : ''}`}
            onTouchStart={(e) => handlePress(3, 'right', e)}
            onTouchEnd={handleRelease}
            onMouseDown={(e) => handlePress(3, 'right', e)}
            onMouseUp={handleRelease}
            onMouseLeave={handleRelease}
            disabled={fuelDepleted}
            title="Pitch Right [D / →]"
          >
            <span className="btn-icon">▶</span>
            <span className="btn-subtext">PITCH RIGHT</span>
            <span className="key-hint">D / →</span>
          </button>
        </div>

        {/* Right Hand: High-Priority Main Engine Thruster */}
        <div className="touch-group right-group">
          <button
            className={`touch-btn thrust-btn ${activeButton === 'thrust' ? 'pressed' : ''} ${
              fuelDepleted ? 'depleted' : ''
            }`}
            onTouchStart={(e) => handlePress(1, 'thrust', e)}
            onTouchEnd={handleRelease}
            onMouseDown={(e) => handlePress(1, 'thrust', e)}
            onMouseUp={handleRelease}
            onMouseLeave={handleRelease}
            disabled={fuelDepleted}
            title="Main Engine Thrust [W / ↑]"
          >
            <div className="thrust-btn-content">
              <span className="thrust-flame-icon">▲</span>
              <span className="thrust-main-label">MAIN THRUST</span>
              <span className="key-hint">W / ↑</span>
            </div>
            {activeButton === 'thrust' && <span className="thrust-flare-ring" />}
          </button>
        </div>
      </div>
    </div>
  );
}
