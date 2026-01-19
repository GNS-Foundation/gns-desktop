import React, { useState } from 'react';
import { useOrgService, OrgStatus } from '../services/OrgService';
import { useIdentity } from '../hooks/useIdentity';
import { OrgManageScreen } from './OrgManageScreen';
import './MyOrganizationsScreen.css';

export function MyOrganizationsScreen({ onBack, onRegister }) {
    const {
        registrations,
        loading,
        syncWithServer,
        verifyDns,
        activate,
        deleteRegistration
    } = useOrgService();

    const { identity } = useIdentity();
    const [managingOrg, setManagingOrg] = useState(null);

    const handleVerify = async (reg) => {
        const res = await verifyDns(reg);
        if (res.success) {
            alert(`✅ ${reg.namespace}@ verified!`);
        } else {
            alert(`❌ ${res.error || 'Verification failed'}`);
        }
    };

    const handleActivate = async (reg) => {
        if (!identity?.publicKey) {
            alert('No identity loaded');
            return;
        }
        const res = await activate(reg, identity.publicKey);
        if (res.success) {
            alert(`🎉 ${reg.namespace}@ activated!`);
        } else {
            alert(`❌ ${res.error || 'Activation failed'}`);
        }
    };

    const handleDelete = (reg) => {
        if (window.confirm(`Delete ${reg.namespace}@ from local list?`)) {
            deleteRegistration(reg.namespace);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Copied!'); // Simple toast
    };

    // Sort registrations
    const sortedRegs = [...registrations].sort((a, b) => {
        const order = { [OrgStatus.ACTIVE]: 0, [OrgStatus.VERIFIED]: 1, [OrgStatus.PENDING]: 2, [OrgStatus.SUSPENDED]: 3 };
        return (order[a.status] || 4) - (order[b.status] || 4);
    });

    if (managingOrg) {
        return <OrgManageScreen reg={managingOrg} onBack={() => setManagingOrg(null)} />;
    }

    return (
        <div className="my-orgs-screen">
            <header className="my-orgs-header">
                <div>
                    <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', marginRight: '8px' }}>←</button>
                    <span style={{ fontWeight: 'bold', fontSize: '18px' }}>My Organizations</span>
                </div>
                <button className="refresh-btn" onClick={syncWithServer} disabled={loading}>
                    {loading ? '⏳' : '🔄'}
                </button>
            </header>

            {sortedRegs.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">🏢</div>
                    <h3>No Organizations Yet</h3>
                    <p>Register your organization to claim a namespace like company@</p>
                    <button className="fab" onClick={onRegister} style={{ position: 'static', marginTop: '20px' }}>
                        <span>+</span> Register Organization
                    </button>
                </div>
            ) : (
                <>
                    {sortedRegs.map(reg => (
                        <OrgCard
                            key={reg.namespace}
                            reg={reg}
                            onVerify={() => handleVerify(reg)}
                            onActivate={() => handleActivate(reg)}
                            onManage={() => setManagingOrg(reg)}
                            onDelete={() => handleDelete(reg)}
                            onCopy={copyToClipboard}
                        />
                    ))}
                    <button className="fab" onClick={onRegister}>
                        <span>+</span> Register Org
                    </button>
                </>
            )}
        </div>
    );
}

function OrgCard({ reg, onVerify, onActivate, onManage, onDelete, onCopy }) {
    const getStatusClass = (status) => `status-${status}`;
    const getIcon = (status) => {
        switch (status) {
            case OrgStatus.PENDING: return '⏳';
            case OrgStatus.VERIFIED: return '✅';
            case OrgStatus.ACTIVE: return '🚀';
            default: return '⚠️';
        }
    };

    return (
        <div className="org-card">
            <div className={`org-card-header ${getStatusClass(reg.status)}`}>
                <div className="org-icon">{getIcon(reg.status)}</div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold' }}>{reg.organizationName}</div>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>{reg.namespace}@</div>
                </div>
                <div className={`status-badge ${getStatusClass(reg.status)}`} style={{ backgroundColor: 'white' }}>
                    {reg.status}
                </div>
            </div>

            <div className="org-details">
                <div className="detail-row">
                    <span className="detail-label">Domain:</span>
                    <span>{reg.domain}</span>
                </div>
                <div className="detail-row">
                    <span className="detail-label">Tier:</span>
                    <span style={{ textTransform: 'uppercase' }}>{reg.tier}</span>
                </div>

                {reg.status === OrgStatus.PENDING && (
                    <div className="dns-box">
                        <div className="dns-title">⚠️ DNS Verification Required</div>
                        <div style={{ fontSize: '11px', marginBottom: '4px' }}>Add TXT record:</div>
                        <div className="copy-field" onClick={() => onCopy(reg.txtRecordHost || `_gns.${reg.domain}`)}>
                            <span>{reg.txtRecordHost || `_gns.${reg.domain}`}</span>
                            <span>📋</span>
                        </div>
                        <div className="copy-field" onClick={() => onCopy(reg.txtRecordValue || `gns-verify=${reg.verificationCode}`)}>
                            <span>{reg.txtRecordValue || `gns-verify=${reg.verificationCode}`}</span>
                            <span>📋</span>
                        </div>
                    </div>
                )}

                <div className="org-actions">
                    {reg.status === OrgStatus.PENDING && (
                        <button className="action-btn btn-verify" onClick={onVerify}>Check DNS</button>
                    )}
                    {reg.status === OrgStatus.VERIFIED && (
                        <button className="action-btn btn-activate" onClick={onActivate}>Activate Namespace</button>
                    )}
                    {reg.status === OrgStatus.ACTIVE && (
                        <button className="action-btn btn-manage" onClick={onManage}>Manage</button>
                    )}
                    <button className="action-btn btn-delete" onClick={onDelete}>🗑️</button>
                </div>
            </div>
        </div>
    );
}
