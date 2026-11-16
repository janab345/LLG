import React from 'react';

function formatTime(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `T+${String(mins).padStart(2, '0')}:${secs.padStart(4, '0')}`;
}

export default function TelemetryCockpit({ state, onToggleMode, isMobileCollapsed = false, onToggleCollapse }) {
  const sinkRate = state.sink_rate || (state.vertical_velocity < 0 ? -state.vertical_velocity : 0);
  const isSinkSafe = sinkRate <= (state.max_sink_rate || 1.0);
  const isTiltSafe = Math.abs(state.tilt_angle || 0) <= (state.max_tilt_angle || 10.0);
  const onPad = Math.abs(state.range_to_pad || 0) <= ((state.pad_width || 50) / 2.0);
  const fuelRemaining = Math.max(0, 100 - (state.fuel_consumed || 0));

  return (
    <div className={`telemetry-cockpit-panel ${isMobileCollapsed ? 'collapsed' : ''}`}>
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="telemetry-badge-dot" />
          <h2 className="panel-title">FLIGHT TELEMETRY</h2>
        </div>

        <div className="panel-header-actions">
          <button
            className={`mode-toggle-btn ${state.mode === 'Hard' ? 'mode-hard' : 'mode-easy'}`}
            onClick={onToggleMode}
            title="Click to toggle flight mode [M]"
          >
            {state.mode.toUpperCase()} MODE
          </button>

          {onToggleCollapse && (
            <button
              className="collapse-toggle-btn"
              onClick={onToggleCollapse}
              aria-label="Toggle telemetry view"
            >
              {isMobileCollapsed ? '▲ EXPAND' : '▼ HIDE'}
            </button>
          )}
        </div>
      </div>

      {/* Primary Status Banner */}
      <div className={`status-banner ${state.is_terminal ? (state.landing_success ? 'status-success' : 'status-danger') : (state.is_paused ? 'status-paused' : 'status-active')}`}>
        <span className="status-banner-text">
          {state.is_paused
            ? 'PAUSED [SPACEBAR]'
            : state.is_terminal
            ? state.status_message
            : `FLIGHT PHASE: DESCENT [${state.mode}]`}
        </span>
      </div>

      {/* Main Parameters Grid (LLG.md specification) */}
      <div className="telemetry-grid">
        {/* Timestamp */}
        <div className="telemetry-card">
          <span className="param-label">TIME STAMP</span>
          <span className="param-value mono">{formatTime(state.elapsed_time)}</span>
          <span className="param-sub">MISSION CLOCK</span>
        </div>

        {/* Altitude */}
        <div className="telemetry-card">
          <span className="param-label">ALTITUDE</span>
          <span className="param-value mono highlight-white">
            {Math.round(state.altitude || 0)} <span className="unit">m</span>
          </span>
          <span className="param-sub">TOUCHDOWN: 0 m</span>
        </div>

        {/* Range to Pad */}
        <div className="telemetry-card">
          <span className="param-label">RANGE TO PAD</span>
          <div className="param-value-row">
            <span className={`param-value mono ${onPad ? 'text-accent' : 'text-warm'}`}>
              {Math.abs(Math.round(state.range_to_pad || 0))} <span className="unit">m</span>
            </span>
            <span className="dir-tag">
              {(state.range_to_pad || 0) < 0 ? 'WEST' : (state.range_to_pad || 0) > 0 ? 'EAST' : 'CENTER'}
            </span>
          </div>
          <span className="param-sub">PAD WINDOW: ±25 m</span>
        </div>

        {/* Vertical Velocity */}
        <div className="telemetry-card">
          <span className="param-label">VERTICAL VELOCITY</span>
          <span className={`param-value mono ${(state.vertical_velocity || 0) < 0 ? 'text-warn' : 'text-accent'}`}>
            {(state.vertical_velocity || 0) > 0 ? '+' : ''}
            {(state.vertical_velocity || 0).toFixed(1)} <span className="unit">m/s</span>
          </span>
          <span className="param-sub">{(state.vertical_velocity || 0) < 0 ? 'DESCENDING' : 'ASCENDING'}</span>
        </div>

        {/* Sink Rate with Safety Gate */}
        <div className="telemetry-card">
          <div className="param-header-row">
            <span className="param-label">SINK RATE</span>
            <span className={`gate-pill ${isSinkSafe ? 'gate-safe' : 'gate-limit'}`}>
              {isSinkSafe ? 'SAFE' : 'LIMIT'}
            </span>
          </div>
          <span className={`param-value mono ${isSinkSafe ? 'text-accent' : 'text-danger'}`}>
            {sinkRate.toFixed(1)} <span className="unit">m/s</span>
          </span>
          <span className="param-sub">GATE: &lt; {state.max_sink_rate} m/s</span>
        </div>

        {/* Horizontal Velocity */}
        <div className="telemetry-card">
          <span className="param-label">HORIZONTAL VEL</span>
          <span className="param-value mono">
            {(state.horizontal_velocity || 0).toFixed(1)} <span className="unit">m/s</span>
          </span>
          <span className="param-sub">CROSS-TRACK DRIFT</span>
        </div>

        {/* Tilt Angle with Horizon Gate */}
        <div className="telemetry-card">
          <div className="param-header-row">
            <span className="param-label">TILT ANGLE</span>
            <span className={`gate-pill ${isTiltSafe ? 'gate-safe' : 'gate-limit'}`}>
              {isTiltSafe ? 'SAFE' : 'LIMIT'}
            </span>
          </div>
          <span className={`param-value mono ${isTiltSafe ? 'text-accent' : 'text-danger'}`}>
            {Math.round(state.tilt_angle || 0)}°
          </span>
          <span className="param-sub">LIMIT: &lt; {state.max_tilt_angle}°</span>
        </div>

        {/* Fuel Consumption Card with Dynamic Meter */}
        <div className="telemetry-card fuel-card">
          <div className="param-header-row">
            <span className="param-label">FUEL CONSUMED</span>
            <span className={`fuel-pct-text mono ${state.fuel_consumed >= 100 ? 'text-danger' : fuelRemaining < 20 ? 'text-warn' : 'text-accent'}`}>
              {Math.round(state.fuel_consumed || 0)}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="fuel-bar-container">
            <div
              className={`fuel-bar-fill ${fuelRemaining < 20 ? 'fuel-danger' : fuelRemaining < 45 ? 'fuel-warn' : 'fuel-nominal'}`}
              style={{ width: `${Math.max(0, 100 - (state.fuel_consumed || 0))}%` }}
            />
          </div>

          <div className="fuel-legend">
            <span>REMAINING: {Math.round(fuelRemaining)}%</span>
            <span>{state.fuel_consumed >= 100 ? 'DEPLETED' : 'FLOW NOMINAL'}</span>
          </div>
        </div>

        {/* Result Status */}
        <div className="telemetry-card result-card">
          <span className="param-label">EPISODE RESULT</span>
          <div className="result-indicator-row">
            <span
              className={`result-tag ${
                !state.is_terminal
                  ? 'result-active'
                  : state.landing_success
                  ? 'result-success'
                  : 'result-crash'
              }`}
            >
              {!state.is_terminal
                ? 'IN PROGRESS'
                : state.landing_success
                ? 'SUCCESS (TRUE)'
                : 'CRASH (FALSE)'}
            </span>
          </div>
        </div>
      </div>

      {/* Safety Matrix Table */}
      <div className="safety-matrix">
        <div className="safety-row">
          <span className="safety-label">SINK CRITERIA</span>
          <span className={`safety-value ${isSinkSafe ? 'ok' : 'violated'}`}>
            {sinkRate.toFixed(1)} / {state.max_sink_rate} m/s
          </span>
        </div>
        <div className="safety-row">
          <span className="safety-label">TILT CRITERIA</span>
          <span className={`safety-value ${isTiltSafe ? 'ok' : 'violated'}`}>
            {Math.abs(Math.round(state.tilt_angle || 0))}° / {state.max_tilt_angle}°
          </span>
        </div>
        <div className="safety-row">
          <span className="safety-label">PAD TOUCHDOWN ZONE</span>
          <span className={`safety-value ${onPad ? 'ok' : 'violated'}`}>
            {onPad ? 'WITHIN TARGET' : 'OUTSIDE PAD'}
          </span>
        </div>
      </div>
    </div>
  );
}
