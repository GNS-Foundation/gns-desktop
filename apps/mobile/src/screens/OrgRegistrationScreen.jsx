import React from 'react';
import './OrgRegistrationScreen.css';

export function OrgRegistrationScreen({ onBack }) {
    return (
        <div className="org-registration-screen">
            <div className="org-header">
                <div style={{ fontSize: '48px' }}>🚧</div>
                <h2>Under Maintenance</h2>
                <p>Organization registration is currently being updated.</p>
            </div>
            <button className="primary-btn" onClick={onBack}>
                Go Back
            </button>
        </div>
    );
}
