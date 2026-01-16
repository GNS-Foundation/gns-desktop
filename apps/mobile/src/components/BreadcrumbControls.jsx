import React from 'react';
import './BreadcrumbControls.css';

export function BreadcrumbControls({ status, onStart, onStop, onDrop }) {
    const isCollecting = status?.isCollecting || false;
    const breadcrumbCount = status?.count || 0;

    const handleDrop = async () => {
        try {
            const result = await onDrop();

            if (result?.success) {
                alert(`🍞 Breadcrumb #${breadcrumbCount + 1} dropped!`);
            } else if (result?.rejection) {
                showRejectionDialog(result.rejection);
            }
        } catch (error) {
            alert(`Error dropping breadcrumb: ${error.message}`);
        }
    };

    const showRejectionDialog = (rejection) => {
        const messages = {
            sameLocation: '📍 You\'re still in the same spot! Move to a new location.',
            tooClose: '📏 You haven\'t moved far enough. Walk at least 50 meters.',
            tooFast: '🚀 That speed seems unrealistic. Wait a moment and try again.',
            noGps: '📡 No GPS signal. Enable Location Services.',
            notInitialized: '⚠️ Not ready. Please wait a moment.',
        };

        alert(messages[rejection] || 'Cannot drop breadcrumb at this time.');
    };

    return (
        <div className="breadcrumb-controls">
            <div className="status-header">
                <div className={`status-indicator ${isCollecting ? 'active' : ''}`}></div>
                <span className="status-text">
                    {isCollecting ? 'COLLECTING' : 'PAUSED'}
                </span>
                {breadcrumbCount > 0 && (
                    <span className="breadcrumb-count">{breadcrumbCount} breadcrumbs</span>
                )}
            </div>

            <div className="control-buttons">
                <button
                    className={`control-btn ${isCollecting ? 'stop' : 'start'}`}
                    onClick={isCollecting ? onStop : onStart}
                >
                    {isCollecting ? 'STOP' : 'START'}
                </button>

                <button
                    className="control-btn drop"
                    onClick={handleDrop}
                >
                    DROP NOW
                </button>
            </div>
        </div>
    );
}
