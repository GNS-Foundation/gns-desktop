import React from 'react';
import './ContactCard.css';

export function ContactCard({ contact, onTap }) {
    const { name, handle, publicKey, lastSeen } = contact;

    const initial = (name || handle || 'U').charAt(0).toUpperCase();
    const displayName = name || `@${handle}` || 'Unknown';
    const displayHandle = handle ? `@${handle}` : publicKey?.substring(0, 16) + '...';

    return (
        <div className="contact-card" onClick={onTap}>
            <div className="contact-avatar">
                {initial}
            </div>

            <div className="contact-info">
                <div className="contact-name">{displayName}</div>
                <div className="contact-handle">{displayHandle}</div>
            </div>

            {lastSeen && (
                <div className="contact-status">
                    <div className="status-indicator"></div>
                </div>
            )}

            <div className="chevron">›</div>
        </div>
    );
}
