import React, { useState } from 'react';
import './IdentityCard.css';

export function IdentityCard({ identity, onEdit, onCreate }) {
    const [newName, setNewName] = useState('');

    if (!identity) {
        return (
            <div className="identity-card">
                <div className="empty-state">
                    <h3>No Identity Found</h3>
                    <p>Create a new sovereign identity to get started.</p>
                    <input
                        type="text"
                        className="identity-input"
                        placeholder="Enter your name (e.g. Alice)"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                    <button
                        className="create-btn"
                        onClick={() => newName.trim() && onCreate(newName)}
                        disabled={!newName.trim()}
                    >
                        Create Identity
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="identity-card">
            <div className="card-header">
                <div className="avatar">
                    {identity.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="identity-info">
                    <h2 className="identity-name">{identity.name || 'Anonymous'}</h2>
                    {identity.handle && (
                        <p className="identity-handle">@{identity.handle}</p>
                    )}
                </div>
                {onEdit && (
                    <button className="edit-btn" onClick={onEdit}>
                        ✏️
                    </button>
                )}
            </div>

            <div className="public-key-section">
                <label>Public Key</label>
                <div className="public-key">
                    {identity.publicKey?.substring(0, 16)}...{identity.publicKey?.slice(-16)}
                </div>
            </div>

            {identity.qrCode && (
                <div className="qr-section">
                    <img src={identity.qrCode} alt="Identity QR Code" className="qr-code" />
                </div>
            )}
        </div>
    );
}
