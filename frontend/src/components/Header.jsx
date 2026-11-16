import React from 'react';

export default function Header({ connectionMode, mode, onToggleMode, onDownloadCsv, isMobileMenuOpen, onToggleMobileMenu }) {
  return (
    <header className="app-header">
      {/* Brand / Title */}
      <div className="header-brand">
        <img src="/PDI_logo.png" alt="LLG" className="header-logo" onError={(e) => (e.target.style.display = 'none')} />
        <div>
          <h1 className="header-title">LUNAR LANDER MISSION CONTROL</h1>
          <div className="header-sub">GYMNASIUM RL & TELEMETRY SUITE</div>
        </div>
      </div>

      {/* Engine & Telemetry Status */}
      <div className="header-center">
        <div className="engine-status-pill">
          <span
            className={`status-dot ${
              connectionMode === 'online' ? 'status-online' : connectionMode === 'connecting' ? 'status-connecting' : 'status-standalone'
            }`}
          />
          <span className="mono status-label">
            {connectionMode === 'online'
              ? 'FASTAPI WS (60 HZ)'
              : connectionMode === 'connecting'
              ? 'CONNECTING...'
              : 'STANDALONE ENGINE'}
          </span>
        </div>

        <button
          className={`mode-indicator-btn ${mode === 'Hard' ? 'mode-hard' : 'mode-easy'}`}
          onClick={onToggleMode}
          title="Click to switch flight mode [M]"
        >
          {mode === 'Hard' ? 'HARD MODE (1.62 m/s²)' : 'EASY MODE (ZERO-G)'}
        </button>
      </div>

      {/* Actions */}
      <div className="header-actions">
        <button className="csv-download-btn" onClick={onDownloadCsv} title="Download logged flight telemetry CSV">
          <span className="btn-icon">📥</span>
          <span className="btn-label">CSV TELEMETRY</span>
        </button>

        {onToggleMobileMenu && (
          <button className="mobile-menu-btn" onClick={onToggleMobileMenu} aria-label="Toggle telemetry drawer">
            {isMobileMenuOpen ? '✕ CLOSE' : '☰ TELEMETRY'}
          </button>
        )}
      </div>
    </header>
  );
}
