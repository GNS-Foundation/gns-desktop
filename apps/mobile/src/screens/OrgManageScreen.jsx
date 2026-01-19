import React, { useState } from 'react';
import './OrgManageScreen.css';

export function OrgManageScreen({ reg, onBack }) {
    const [activeTab, setActiveTab] = useState('members'); // members, settings

    const handleAddMember = () => {
        alert('Add Member - Coming soon');
    };

    return (
        <div className="org-manage-screen">
            <header className="manage-header">
                <button onClick={onBack} className="back-btn">←</button>
                <div className="header-title">
                    <h1>{reg.organizationName}</h1>
                    <span className="namespace-badge">{reg.namespace}@</span>
                </div>
                <button className="settings-btn" onClick={() => setActiveTab('settings')}>⚙️</button>
            </header>

            <div className="org-stats-card">
                <div className="stat-item">
                    <span className="stat-label">Tier</span>
                    <span className="stat-value">{reg.tier.toUpperCase()}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Members</span>
                    <span className="stat-value">1 / {reg.tier === 'starter' ? 10 : 100}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Status</span>
                    <span className="stat-value active">Active</span>
                </div>
            </div>

            <div className="manage-tabs">
                <button
                    className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
                    onClick={() => setActiveTab('members')}
                >
                    Members
                </button>
                <button
                    className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    Settings
                </button>
            </div>

            <div className="manage-content">
                {activeTab === 'members' ? (
                    <div className="members-list-view">
                        <div className="list-actions">
                            <h3>Team Members</h3>
                            <button className="add-btn" onClick={handleAddMember}>+ Add Member</button>
                        </div>

                        <div className="member-card">
                            <div className="member-avatar">👤</div>
                            <div className="member-info">
                                <div className="member-name">Admin</div>
                                <div className="member-role">Owner</div>
                            </div>
                            <div className="member-status">Active</div>
                        </div>

                        {/* Placeholder for empty state if needed */}
                        {/* <div className="empty-members">No other members yet</div> */}
                    </div>
                ) : (
                    <div className="settings-view">
                        <h3>Organization Settings</h3>

                        <div className="setting-group">
                            <label>Domain</label>
                            <input type="text" value={reg.domain} disabled className="readonly-input" />
                        </div>

                        <div className="setting-group">
                            <label>Admin Email</label>
                            <input type="text" value={reg.email || ''} disabled className="readonly-input" />
                        </div>

                        <button className="danger-btn" onClick={() => alert('Contact support to delete active organization')}>
                            Delete Organization
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
