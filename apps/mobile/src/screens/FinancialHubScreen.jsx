import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStellar } from '../hooks/useStellar';
import { BalanceCard } from '../components/BalanceCard';
import './FinancialHubScreen.css';

export function FinancialHubScreen() {
    const navigate = useNavigate();
    const { balances, history, loading, loadBalances, loadHistory } = useStellar();

    useEffect(() => {
        loadBalances();
        loadHistory(5); // Load recent 5 transactions
    }, [loadBalances, loadHistory]);

    return (
        <div className="financial-hub-screen">
            <header className="hub-header">
                <button className="back-btn" onClick={() => navigate(-1)}>←</button>
                <h2>Financial Hub</h2>
                <button className="settings-btn">⚙️</button>
            </header>

            <div className="hub-content">
                {loading && <div className="loading-indicator">Updating...</div>}

                <BalanceCard balances={balances} />

                {/* Quick Actions */}
                <div className="quick-actions">
                    <ActionButton
                        icon="⬆️"
                        label="Send"
                        color="#3498db"
                        onClick={() => navigate('/financial/send')}
                    />
                    <ActionButton
                        icon="📊"
                        label="Analytics"
                        color="#2ecc71"
                        onClick={() => navigate('/financial/analytics')}
                    />
                    <ActionButton
                        icon="📜"
                        label="History"
                        color="#f39c12"
                        onClick={() => navigate('/financial/history')}
                    />
                    <ActionButton
                        icon="🎁"
                        label="Rewards"
                        color="#9b59b6"
                        onClick={() => navigate('/financial/loyalty')}
                    />
                    <ActionButton
                        icon="🔄"
                        label="Subs"
                        color="#e67e22"
                        onClick={() => navigate('/financial/subscriptions')}
                    />
                    <ActionButton
                        icon="🔗"
                        label="Links"
                        color="#1abc9c"
                        onClick={() => navigate('/financial/links')}
                    />
                </div>

                {/* Recent Activity */}
                <div className="recent-activity">
                    <div className="section-header">
                        <h3>Recent Activity</h3>
                        <button onClick={() => navigate('/financial/history')}>See All</button>
                    </div>

                    {history.length === 0 ? (
                        <div className="empty-state">No transactions yet</div>
                    ) : (
                        <div className="transaction-list">
                            {history.map((tx, index) => (
                                <TransactionItem key={index} tx={tx} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ActionButton({ icon, label, color, onClick }) {
    return (
        <button className="action-btn" onClick={onClick} style={{ color: color, borderColor: `${color}33` }}>
            <div className="icon-circle" style={{ background: `${color}22` }}>{icon}</div>
            <span>{label}</span>
        </button>
    );
}

function TransactionItem({ tx }) {
    const isSent = tx.type === 'payment' && !tx.is_received;
    // Note: Rust PaymentHistoryItem struct needs to be checked for fields matching JS
    // Assuming backend returns: { type, amount, asset_code, counterparty, created_at, ... }

    return (
        <div className="transaction-item">
            <div className={`tx-icon ${isSent ? 'sent' : 'received'}`}>
                {isSent ? '⬆️' : '⬇️'}
            </div>
            <div className="tx-details">
                <div className="tx-title">
                    {isSent ? `Sent to ${shorten(tx.to)}` : `Received from ${shorten(tx.from)}`}
                </div>
                <div className="tx-date">{new Date(tx.created_at).toLocaleDateString()}</div>
            </div>
            <div className={`tx-amount ${isSent ? 'sent' : 'received'}`}>
                {isSent ? '-' : '+'}{parseFloat(tx.amount).toFixed(2)} {tx.asset_code}
            </div>
        </div>
    );
}

function shorten(str) {
    if (!str) return 'Unknown';
    if (str.length < 10) return str;
    return str.substring(0, 4) + '...' + str.substring(str.length - 4);
}
