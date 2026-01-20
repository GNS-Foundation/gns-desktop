import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscriptions } from '../hooks/useSubscriptions';
import './SubscriptionsScreen.css';

export function SubscriptionsScreen() {
    const navigate = useNavigate();
    const { loading, subscriptions, toggleStatus, cancelSubscription } = useSubscriptions();
    const [activeTab, setActiveTab] = useState('active');

    const activeSubs = subscriptions.filter(s => ['active', 'paused'].includes(s.status));
    const pastSubs = subscriptions.filter(s => !['active', 'paused'].includes(s.status));
    const upcomingRenewals = activeSubs.filter(s => s.daysUntilRenewal <= 7);

    const handleAction = async (sub) => {
        if (sub.status === 'active') {
            if (confirm(`Pause subscription for ${sub.planName}?`)) {
                await toggleStatus(sub.id, 'active');
            }
        } else if (sub.status === 'paused') {
            await toggleStatus(sub.id, 'paused');
        }
    };

    const handleCancel = async (sub) => {
        if (confirm(`Are you sure you want to cancel ${sub.planName}?`)) {
            await cancelSubscription(sub.id);
        }
    };

    if (loading) return <div className="subscriptions-screen"><div style={{ padding: 20 }}>Loading...</div></div>;

    return (
        <div className="subscriptions-screen">
            <header className="subs-header">
                <div className="subs-nav">
                    <button style={{ background: 'none', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer', marginRight: 16 }} onClick={() => navigate(-1)}>←</button>
                    <h2 style={{ margin: 0, fontSize: 18 }}>Subscriptions</h2>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                    <button
                        onClick={() => setActiveTab('active')}
                        style={{ flex: 1, background: 'none', border: 'none', color: activeTab === 'active' ? '#6c5ce7' : '#888', padding: '12px 0', borderBottom: activeTab === 'active' ? '2px solid #6c5ce7' : 'none', fontWeight: 'bold' }}
                    >
                        Active ({activeSubs.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('past')}
                        style={{ flex: 1, background: 'none', border: 'none', color: activeTab === 'past' ? '#6c5ce7' : '#888', padding: '12px 0', borderBottom: activeTab === 'past' ? '2px solid #6c5ce7' : 'none', fontWeight: 'bold' }}
                    >
                        Past ({pastSubs.length})
                    </button>
                </div>
            </header>

            <div className="subs-content">
                {activeTab === 'active' && upcomingRenewals.length > 0 && (
                    <div className="subs-banner">
                        <div className="sb-icon">📅</div>
                        <div>
                            <div style={{ fontWeight: 'bold' }}>{upcomingRenewals.length} renewals this week</div>
                            <div style={{ fontSize: 12, opacity: 0.8 }}>Total: ${upcomingRenewals.reduce((sum, s) => sum + s.amount, 0).toFixed(2)}</div>
                        </div>
                    </div>
                )}

                {(activeTab === 'active' ? activeSubs : pastSubs).map(sub => (
                    <div className="sub-card" key={sub.id}>
                        <div className="sub-header">
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div className="sub-icon">🔄</div>
                                <div>
                                    <div className="sub-name">{sub.planName}</div>
                                    <div className="sub-merchant">{sub.merchantName}</div>
                                </div>
                            </div>
                            <div className={`sub-status ${sub.status}`}>
                                {sub.status.toUpperCase()}
                            </div>
                        </div>

                        <div className="sub-details">
                            <div>
                                <div className="sub-price">${sub.amount}</div>
                                <div className="sub-cycle">{sub.billingCycle}</div>
                            </div>
                            <div>
                                {activeTab === 'active' && (
                                    <div className="sub-renewal">
                                        Next: {sub.nextBillingDate}
                                    </div>
                                )}
                            </div>
                        </div>

                        {activeTab === 'active' && (
                            <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                                <button
                                    onClick={() => handleAction(sub)}
                                    style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#333', color: 'white', border: 'none' }}
                                >
                                    {sub.status === 'active' ? 'Pause' : 'Resume'}
                                </button>
                                <button
                                    onClick={() => handleCancel(sub)}
                                    style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c', border: 'none' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
