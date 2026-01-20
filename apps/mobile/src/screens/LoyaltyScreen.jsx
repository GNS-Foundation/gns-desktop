import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoyalty } from '../hooks/useLoyalty';
import './LoyaltyScreen.css';

export function LoyaltyScreen() {
    const navigate = useNavigate();
    const { loading, profile, rewards, achievements, history, redeemReward } = useLoyalty();
    const [activeTab, setActiveTab] = useState('overview');
    const [redeeming, setRedeeming] = useState(null);

    const handleRedeem = async (reward) => {
        if ((profile?.availablePoints || 0) < reward.pointsCost) return;

        if (confirm(`Redeem "${reward.name}" for ${reward.pointsCost} points?`)) {
            setRedeeming(reward.id);
            await redeemReward(reward.id);
            setRedeeming(null);
            alert(`🎉 Redeemed: ${reward.name}`);
        }
    };

    if (loading) {
        return (
            <div className="loyalty-screen">
                <header className="loyalty-header">
                    <div className="loyalty-nav"><h2 style={{ margin: 0 }}>Rewards</h2></div>
                </header>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>Loading...</div>
            </div>
        );
    }

    return (
        <div className="loyalty-screen">
            <header className="loyalty-header">
                <div className="loyalty-nav">
                    <button style={{ background: 'none', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer' }} onClick={() => navigate(-1)}>←</button>
                    <h2 style={{ margin: 0, fontSize: 18 }}>Rewards</h2>
                    <button style={{ background: 'none', border: 'none', color: 'white', fontSize: 20 }}>🔗</button>
                </div>
                <div className="loyalty-tabs">
                    {['overview', 'rewards', 'achievements'].map(tab => (
                        <button
                            key={tab}
                            className={`loyalty-tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </header>

            <div className="loyalty-content">
                {activeTab === 'overview' && (
                    <>
                        <div className="points-card">
                            <div className="pc-header">
                                <span className="pc-label">Available Points</span>
                                <span className="pc-tier-badge">{profile.tier.emoji} {profile.tier.displayName}</span>
                            </div>
                            <div className="pc-points">{profile.availablePoints}</div>
                            <div className="pc-stats">
                                <div className="pc-stat">
                                    <span className="pc-stat-label">Lifetime</span>
                                    <span className="pc-stat-value">{profile.lifetimePoints}</span>
                                </div>
                                <div className="pc-stat">
                                    <span className="pc-stat-label">Transactions</span>
                                    <span className="pc-stat-value">{profile.totalTransactions}</span>
                                </div>
                            </div>
                        </div>

                        <div className="tier-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                <span>Tier Progress</span>
                                <span style={{ fontSize: 12, color: '#888', fontWeight: 'normal' }}>
                                    {profile.pointsToNextTier} pts to {profile.nextTier.displayName}
                                </span>
                            </div>
                            <div className="tc-progress-bar">
                                <div className="tc-progress-fill" style={{ width: `${profile.tierProgressPercent}%` }}></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888' }}>
                                <span>{profile.tier.displayName}</span>
                                <span>{profile.nextTier.displayName}</span>
                            </div>
                        </div>

                        <h3 style={{ margin: '0 0 12px 0' }}>Recent Activity</h3>
                        <div className="activity-list">
                            {history.map((tx, i) => (
                                <div className="activity-item" key={i}>
                                    <div className={`ai-icon ${tx.isCredit ? 'credit' : 'debit'}`}>
                                        {tx.isCredit ? '+' : '-'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500 }}>{tx.description}</div>
                                        <div style={{ fontSize: 12, color: '#888' }}>{tx.date}</div>
                                    </div>
                                    <div className={`ai-points ${tx.isCredit ? 'credit' : 'debit'}`}>
                                        {tx.isCredit ? '+' : ''}{tx.points}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {activeTab === 'rewards' && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {rewards.map(reward => {
                            const canAfford = profile.availablePoints >= reward.pointsCost;
                            return (
                                <div
                                    className="reward-card"
                                    key={reward.id}
                                    style={{ opacity: canAfford ? 1 : 0.5 }}
                                    onClick={() => canAfford && handleRedeem(reward)}
                                >
                                    <div className="rc-icon">
                                        {reward.type === 'discount' ? '💸' : reward.type === 'token' ? '🌐' : '🎁'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold' }}>{reward.name}</div>
                                        <div style={{ fontSize: 12, color: '#888' }}>{reward.description}</div>
                                    </div>
                                    <div className="rc-cost">
                                        <div className="rc-cost-val">{reward.pointsCost}</div>
                                        <div className="rc-cost-label">pts</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'achievements' && (
                    <>
                        <h3 style={{ margin: '0 0 12px 0' }}>Achievements</h3>
                        <div className="achievements-grid">
                            {achievements.map(ach => (
                                <div className={`achievement-badge ${ach.isUnlocked ? 'unlocked' : ''}`} key={ach.id}>
                                    <div className="ab-icon">{ach.icon}</div>
                                    <div className="ab-name">{ach.name}</div>
                                    <div className="ab-desc">{ach.description}</div>
                                    {!ach.isUnlocked && ach.target && (
                                        <div className="ab-progress">
                                            <div className="ab-fill" style={{ width: `${(ach.progress / ach.target) * 100}%` }}></div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
