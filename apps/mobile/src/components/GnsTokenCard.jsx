import React from 'react';
import './GnsTokenCard.css';

export function GnsTokenCard({ balance = 0, claimable = 0, loading = false, onTap }) {
    const hasClaimable = claimable > 0;

    return (
        <div className="gns-token-card" onClick={onTap}>
            <div className="card-header">
                <div className="gns-icon-container">
                    <div className="gns-icon">G</div>
                </div>
                <span className="card-title">GNS TOKENS</span>
                {hasClaimable && (
                    <span className="claimable-badge">
                        {claimable.toFixed(0)} claimable
                    </span>
                )}
                <div className="chevron">›</div>
            </div>

            <div className="balance-display">
                <span className="balance-amount">
                    {loading ? '...' : balance.toFixed(2)}
                </span>
                <span className="balance-currency">GNS</span>
            </div>

            <p className="tap-hint">Tap to view wallet</p>
        </div>
    );
}
