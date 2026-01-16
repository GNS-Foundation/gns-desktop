import React from 'react';
import './PaymentsCard.css';

export function PaymentsCard({ stats = {}, pendingCount = 0, onTap }) {
    const { sent = 0, received = 0 } = stats;

    return (
        <div className="payments-card" onClick={onTap}>
            <div className="card-header">
                <div className="icon-container">
                    <span className="wallet-icon">💳</span>
                </div>
                <span className="card-title">PAYMENTS</span>
                {pendingCount > 0 && (
                    <span className="pending-badge">{pendingCount} pending</span>
                )}
                <div className="chevron">›</div>
            </div>

            <div className="stats-row">
                <div className="stat">
                    <div className="stat-icon sent">↑</div>
                    <div className="stat-info">
                        <span className="stat-label">Sent Today</span>
                        <span className="stat-value">€{sent.toFixed(2)}</span>
                    </div>
                </div>

                <div className="stat-divider"></div>

                <div className="stat">
                    <div className="stat-icon received">↓</div>
                    <div className="stat-info">
                        <span className="stat-label">Received</span>
                        <span className="stat-value">€{received.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div className="action-buttons">
                <button
                    className="action-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Navigate to send money
                    }}
                >
                    <span>📤</span> Send
                </button>
                <button
                    className="action-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Navigate to history
                    }}
                >
                    <span>📜</span> History
                </button>
            </div>
        </div>
    );
}
