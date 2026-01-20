import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useIdentity } from '../hooks/useIdentity';
import './HandleManagement.css';

export function HandleManagement() {
    const navigate = useNavigate();
    const { identity, reload } = useIdentity();

    const [handleInput, setHandleInput] = useState('');
    const [checking, setChecking] = useState(false);
    const [availability, setAvailability] = useState(null); // null | { available: bool, reason: string }
    const [actionLoading, setActionLoading] = useState(false);

    // Load existing handle if any
    useEffect(() => {
        if (identity) {
            if (identity.reservedHandle) {
                setHandleInput(identity.reservedHandle.replace('@', ''));
            } else if (identity.claimedHandle) {
                setHandleInput(identity.claimedHandle.replace('@', ''));
            }
        }
    }, [identity]);

    const handleCheck = async () => {
        if (!handleInput.trim()) return;

        setChecking(true);
        setAvailability(null);

        try {
            // First validate format
            const clean = await invoke('validate_handle_format', { handle: handleInput });
            if (!clean.success) {
                setAvailability({ available: false, reason: clean.error });
                setChecking(false);
                return;
            }

            const result = await invoke('check_handle_available', { handle: handleInput });
            if (result.success) {
                setAvailability(result.data);
            } else {
                setAvailability({ available: false, reason: result.error });
            }
        } catch (e) {
            setAvailability({ available: false, reason: e.toString() });
        } finally {
            setChecking(false);
        }
    };

    const handleReserve = async () => {
        setActionLoading(true);
        try {
            const result = await invoke('reserve_handle', { handle: handleInput });
            if (result.success && result.data.success) {
                alert('Handle reserved successfully!');
                await reload();
            } else {
                const msg = result.error || (result.data && result.data.error) || 'Unknown error';
                alert('Reservation failed: ' + msg);
            }
        } catch (e) {
            alert('Error: ' + e);
        } finally {
            setActionLoading(false);
        }
    };

    const handleClaim = async () => {
        setActionLoading(true);
        try {
            const result = await invoke('claim_handle', { handle: handleInput });
            if (result.success && result.data.success) {
                alert('Handle claimed successfully! You are now verified on the GNS network.');
                await reload();
            } else {
                const msg = result.error || (result.data && result.data.message) || 'Unknown error';
                // Show detailed error if available
                const detail = result.data && result.data.error ? `\n${result.data.error}` : '';
                alert(`Claim failed: ${msg}${detail}`);
            }
        } catch (e) {
            alert('Error: ' + e);
        } finally {
            setActionLoading(false);
        }
    };

    const hasReserved = !!identity?.reservedHandle;
    const hasClaimed = !!identity?.claimedHandle;
    const currentHandle = identity?.claimedHandle || identity?.reservedHandle || '';
    // TODO: breadcrumbCount should come from identity or DB
    const breadcrumbCount = identity?.breadcrumbCount || 0;
    const isReadyToClaim = breadcrumbCount >= 100;

    return (
        <div className="handle-management">
            <header className="hm-header">
                <button className="hm-back-btn" onClick={() => navigate(-1)}>←</button>
                <h2 className="hm-title">Manage Handle</h2>
            </header>

            <div className="hm-content">
                <div className="hm-icon-large">
                    {hasClaimed ? '✓' : hasReserved ? '🔒' : '@'}
                </div>

                {(hasReserved || hasClaimed) && (
                    <div className="hm-status-card">
                        <span className="hm-handle-display">{currentHandle}</span>
                        <span className={`hm-status-label ${hasClaimed ? 'claimed' : 'reserved'}`}>
                            {hasClaimed ? 'VERIFIED OWNER' : 'RESERVED'}
                        </span>
                    </div>
                )}

                {!hasClaimed && (
                    <>
                        {!hasReserved && (
                            <div className="hm-input-group">
                                <span className="hm-input-prefix">@</span>
                                <input
                                    className="hm-input"
                                    value={handleInput}
                                    onChange={(e) => setHandleInput(e.target.value)}
                                    placeholder="desired_handle"
                                    disabled={checking || actionLoading}
                                />
                            </div>
                        )}

                        {!hasReserved && !availability && (
                            <button
                                className="hm-check-btn"
                                onClick={handleCheck}
                                disabled={!handleInput || checking}
                            >
                                {checking ? 'Checking...' : 'Check Availability'}
                            </button>
                        )}

                        {availability && !hasReserved && (
                            <>
                                <div className={`hm-availability-msg ${availability.available ? 'available' : 'unavailable'}`}>
                                    {availability.available
                                        ? 'Available!'
                                        : `Unavailable: ${availability.reason}`}
                                </div>

                                {availability.available && (
                                    <button
                                        className="hm-action-btn"
                                        onClick={handleReserve}
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? 'Reserving...' : 'Reserve Now'}
                                    </button>
                                )}

                                <button
                                    style={{ background: 'none', border: 'none', color: '#666', marginTop: '10px', textDecoration: 'underline' }}
                                    onClick={() => setAvailability(null)}
                                >
                                    Check another
                                </button>
                            </>
                        )}

                        {hasReserved && (
                            <div className="hm-claim-progress">
                                <div className="hm-section-title">CLAIM REQUIREMENTS</div>
                                <div className="hm-progress-track">
                                    <div
                                        className={`hm-progress-bar ${isReadyToClaim ? 'ready' : ''}`}
                                        style={{ width: `${Math.min(breadcrumbCount, 100)}%` }}
                                    ></div>
                                </div>
                                <p className="hm-progress-text">
                                    {breadcrumbCount} / 100 Breadcrumbs collected
                                </p>

                                <button
                                    className="hm-action-btn"
                                    onClick={handleClaim}
                                    disabled={actionLoading || !isReadyToClaim}
                                    style={{ backgroundColor: isReadyToClaim ? '#2ecc71' : '#333' }}
                                >
                                    {actionLoading ? 'Claiming...' : isReadyToClaim ? 'Claim Handle' : 'Collect more breadcrumbs'}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {hasClaimed && (
                    <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
                        Your handle is permanently secured on the GNS network.
                    </div>
                )}
            </div>
        </div>
    );
}
