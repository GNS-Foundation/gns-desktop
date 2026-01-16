import React, { useState } from 'react';
import { useIdentity } from '../hooks/useIdentity';
import './SettingsTab.css';

export function SettingsTab() {
    const { identity } = useIdentity();
    const [isDarkMode, setIsDarkMode] = useState(false);

    const handleProfileEditor = () => {
        alert('Profile Editor - Coming soon');
    };

    const handleHandleManagement = () => {
        alert('Handle Management - Coming soon');
    };

    const handleThemeToggle = () => {
        setIsDarkMode(!isDarkMode);
        // TODO: Implement actual theme switching
        alert(`Theme: ${!isDarkMode ? 'Dark' : 'Light'} mode`);
    };

    const handleDeleteIdentity = () => {
        const confirmed = window.confirm(
            'Are you sure you want to delete your identity? This action cannot be undone.'
        );

        if (confirmed) {
            const doubleConfirm = window.confirm(
                'FINAL WARNING: This will permanently delete your identity, messages, and breadcrumbs. Continue?'
            );

            if (doubleConfirm) {
                // TODO: Call delete identity API
                alert('Identity deletion - Would execute here');
            }
        }
    };

    const handleDebugInfo = () => {
        const debugInfo = {
            publicKey: identity?.publicKey || 'N/A',
            handle: identity?.handle || 'None',
            breadcrumbs: identity?.breadcrumbCount || 0,
            version: '1.0.0',
        };

        alert(`Debug Info:\n${JSON.stringify(debugInfo, null, 2)}`);
    };

    return (
        <div className="settings-tab">
            <header className="settings-header">
                <h1>SETTINGS</h1>
            </header>

            <div className="settings-content">
                {/* Profile Section */}
                <div className="settings-section">
                    <div className="section-title">PROFILE</div>

                    <button className="settings-item" onClick={handleProfileEditor}>
                        <span className="item-icon">👤</span>
                        <span className="item-label">Edit Profile</span>
                        <span className="item-chevron">›</span>
                    </button>

                    <button className="settings-item" onClick={handleHandleManagement}>
                        <span className="item-icon">@</span>
                        <span className="item-label">Handle Management</span>
                        <span className="item-chevron">›</span>
                    </button>
                </div>

                {/* Appearance Section */}
                <div className="settings-section">
                    <div className="section-title">APPEARANCE</div>

                    <div className="settings-item">
                        <span className="item-icon">🌙</span>
                        <span className="item-label">Dark Mode</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={isDarkMode}
                                onChange={handleThemeToggle}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                {/* Developer Section */}
                <div className="settings-section">
                    <div className="section-title">DEVELOPER</div>

                    <button className="settings-item" onClick={handleDebugInfo}>
                        <span className="item-icon">🐛</span>
                        <span className="item-label">Debug Info</span>
                        <span className="item-chevron">›</span>
                    </button>
                </div>

                {/* About Section */}
                <div className="settings-section">
                    <div className="section-title">ABOUT</div>

                    <div className="settings-item passive">
                        <span className="item-label">App Version</span>
                        <span className="item-value">1.0.0</span>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="settings-section danger-zone">
                    <div className="section-title">DANGER ZONE</div>

                    <button className="settings-item danger" onClick={handleDeleteIdentity}>
                        <span className="item-icon">⚠️</span>
                        <span className="item-label">Delete Identity</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
