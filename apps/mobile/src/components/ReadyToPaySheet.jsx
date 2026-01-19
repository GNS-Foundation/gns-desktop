import React, { useEffect, useState } from 'react';
import './ReadyToPaySheet.css';

export function ReadyToPaySheet({ onClose, onScanQr }) {
    // Animation state for waves
    const [wavePhase, setWavePhase] = useState(0);

    // Simple animation loop for the waves
    useEffect(() => {
        const interval = setInterval(() => {
            setWavePhase(prev => (prev + 1) % 3);
        }, 600);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="sheet-overlay" onClick={onClose}>
            <div className="ready-to-pay-sheet" onClick={e => e.stopPropagation()}>
                {/* Handle */}
                <div className="sheet-handle"></div>

                {/* Animated NFC Icon */}
                <div className="nfc-animation-container">
                    {[0, 1, 2].map(i => (
                        <div
                            key={i}
                            className={`wave-ring wave-${i}`}
                            style={{
                                animationDelay: `${i * 0.5}s`
                            }}
                        />
                    ))}

                    <div className="nfc-center-icon">
                        <span className="nfc-symbol">📡</span>
                    </div>
                </div>

                <h2 className="sheet-title">Ready to Pay</h2>

                <p className="sheet-instruction">
                    Hold your phone near the<br />
                    payment terminal
                </p>

                <button className="scan-qr-btn" onClick={onScanQr}>
                    <span className="qr-icon">📷</span>
                    Scan QR Code Instead
                </button>

                <button className="cancel-btn" onClick={onClose}>
                    Cancel
                </button>
            </div>
        </div>
    );
}
