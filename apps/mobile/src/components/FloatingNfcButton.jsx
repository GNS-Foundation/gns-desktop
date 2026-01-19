import React from 'react';
import './FloatingNfcButton.css';

export function FloatingNfcButton({ bottom = 24, right = 16, onTap }) {
    const handleTap = () => {
        // Trigger parent action (show sheet)
        if (onTap) {
            onTap();
        }
    };

    return (
        <div
            className="floating-nfc-button"
            style={{ bottom: `${bottom}px`, right: `${right}px` }}
            onClick={handleTap}
        >
            <div className="nfc-pulse-ring"></div>
            <div className="nfc-pulse-ring delay"></div>

            <div className="nfc-button-content">
                <span className="nfc-icon">
                    📶
                </span>
            </div>
        </div>
    );
}
