import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';

export default function OutcomeModal({ state, onReset, onDownloadCsv, onClose }) {
  const isSuccess = state.landing_success;
  const sinkRate = state.sink_rate || (state.vertical_velocity < 0 ? -state.vertical_velocity : 0);

  useEffect(() => {
    if (isSuccess) {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#689a6a', '#fabd2f', '#4488ff', '#ffffff'],
        });
      } catch (e) {
        // Safe fallback if canvas-confetti is not loaded
      }
    }
  }, [isSuccess]);

  const onPad = Math.abs(state.range_to_pad || 0) <= ((state.pad_width || 50) / 2.0);
  const isSinkSafe = sinkRate <= (state.max_sink_rate || 1.0);
  const isTiltSafe = Math.abs(state.tilt_angle || 0) <= (state.max_tilt_angle || 10.0);

  return (
    <div className="outcome-modal-backdrop" onClick={onClose}>
      <div className="outcome-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Outcome Header Banner */}
        <div className={`outcome-banner ${isSuccess ? 'outcome-success' : 'outcome-danger'}`}>
          <div className="outcome-icon">{isSuccess ? '✔' : '⚠'}</div>
          <div>
            <h2 className="outcome-title">
              {isSuccess ? 'TOUCHDOWN NOMINAL' : 'MISSION ABORT / CRASH'}
            </h2>
            <div className="outcome-subtitle">
              {isSuccess
                ? 'Lander securely anchored inside landing pad perimeter.'
                : state.status_message || 'Vehicle limits exceeded during terminal descent.'}
            </div>
          </div>
        </div>

        {/* Flight Telemetry Debrief Table */}
        <div className="outcome-debrief-grid">
          <div className="debrief-item">
            <span className="debrief-label">TOUCHDOWN SINK RATE</span>
            <span className={`debrief-val mono ${isSinkSafe ? 'text-accent' : 'text-danger'}`}>
              {sinkRate.toFixed(2)} m/s
            </span>
            <span className="debrief-crit">LIMIT: &lt; {state.max_sink_rate} m/s</span>
          </div>

          <div className="debrief-item">
            <span className="debrief-label">FINAL TILT ANGLE</span>
            <span className={`debrief-val mono ${isTiltSafe ? 'text-accent' : 'text-danger'}`}>
              {Math.abs(state.tilt_angle || 0).toFixed(1)}°
            </span>
            <span className="debrief-crit">LIMIT: &lt; {state.max_tilt_angle}°</span>
          </div>

          <div className="debrief-item">
            <span className="debrief-label">PAD ACCURACY</span>
            <span className={`debrief-val mono ${onPad ? 'text-accent' : 'text-warn'}`}>
              {Math.abs(state.range_to_pad || 0).toFixed(1)} m
            </span>
            <span className="debrief-crit">{onPad ? 'INSIDE TARGET' : 'OUTSIDE PAD'}</span>
          </div>

          <div className="debrief-item">
            <span className="debrief-label">TOTAL FUEL BURNED</span>
            <span className="debrief-val mono">
              {Math.round(state.fuel_consumed || 0)}%
            </span>
            <span className="debrief-crit">REMAINING: {Math.max(0, Math.round(100 - state.fuel_consumed))}%</span>
          </div>

          <div className="debrief-item">
            <span className="debrief-label">FLIGHT TIME</span>
            <span className="debrief-val mono">
              {(state.elapsed_time || 0).toFixed(1)} s
            </span>
            <span className="debrief-crit">MODE: {state.mode.toUpperCase()}</span>
          </div>

          <div className="debrief-item">
            <span className="debrief-label">RESULT CODE</span>
            <span className={`debrief-val mono ${isSuccess ? 'text-accent' : 'text-danger'}`}>
              {isSuccess ? 'SUCCESS (1.0)' : 'FAILED (0.0)'}
            </span>
            <span className="debrief-crit">RL POLICY RECORDED</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="outcome-actions">
          <button className="outcome-btn primary-btn" onClick={onReset}>
            ↺ LAUNCH NEW MISSION [R]
          </button>
          <button className="outcome-btn secondary-btn" onClick={onDownloadCsv}>
            📥 EXPORT TELEMETRY CSV
          </button>
          <button className="outcome-btn text-btn" onClick={onClose}>
            INSPECT 3D SCENE
          </button>
        </div>
      </div>
    </div>
  );
}
