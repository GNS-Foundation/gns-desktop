import React from 'react';
import './HandleCard.css';

export function HandleCard({ identity, onManage }) {
    if (!identity) return null;

    const { claimedHandle, reservedHandle, breadcrumbCount = 0 } = identity;
    const canClaim = breadcrumbCount >= 100;
    const remaining = 100 - breadcrumbCount;

    // Already claimed
    if (claimedHandle) {
        return (
            <div className="handle-card claimed" onClick={onManage}>
                <div className="handle-content">
                    <span className="checkmark">✓</span>
                    <span className="handle-text">@{claimedHandle}</span>
                    <span className="status-badge claimed">CLAIMED</span>
                </div>
                <div className="chevron">›</div>
            </div>
        );
    }

    // Reserved but not claimed yet
    if (reservedHandle) {
        return (
            <div className="handle-card reserved" onClick={onManage}>
                <div className="handle-header">
                    <span className="handle-text">@{reservedHandle}</span>
                    <div className="chevron">›</div>
                </div>

                <p className="progress-text">
                    {canClaim
                        ? '✓ Ready to claim!'
                        : `Reserved • ${breadcrumbCount}/100 breadcrumbs`}
                </p>

                <div className="progress-bar">
                    <div
                        className={`progress-fill ${canClaim ? 'complete' : ''}`}
                        style={{ width: `${Math.min(breadcrumbCount, 100)}%` }}
                    ></div>
                </div>

                <p className="hint-text">Tap for details</p>
            </div>
        );
    }

    // No handle yet - prompt to reserve
    return (
        <div className="handle-card empty" onClick={onManage}>
            <div className="empty-content">
                <div className="empty-icon">@</div>
                <p className="empty-title">Reserve Your Handle</p>
                <p className="empty-subtitle">Claim your unique @handle identity</p>
            </div>
            <div className="chevron">›</div>
        </div>
    );
}
