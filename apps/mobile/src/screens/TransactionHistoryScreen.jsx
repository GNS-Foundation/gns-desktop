import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStellar } from '../hooks/useStellar';
import './TransactionHistoryScreen.css';

export function TransactionHistoryScreen() {
    const navigate = useNavigate();
    const { history, loading, loadHistory } = useStellar();

    useEffect(() => {
        loadHistory(50);
    }, [loadHistory]);

    return (
        <div className="history-screen">
            <header className="history-header">
                <button className="back-btn" onClick={() => navigate(-1)}>←</button>
                <h2>Transaction History</h2>
            </header>

            <div className="history-content">
                {loading && <div className="loading">Loading...</div>}

                {history.map((tx, index) => (
                    <HistoryItem key={index} tx={tx} />
                ))}

                {!loading && history.length === 0 && (
                    <div className="empty">No transactions found</div>
                )}
            </div>
        </div>
    );
}

function HistoryItem({ tx }) {
    const isSent = tx.type === 'payment' && !tx.is_received;

    return (
        <div className="history-item">
            <div className={`icon ${isSent ? 'sent' : 'received'}`}>
                {isSent ? '⬆️' : '⬇️'}
            </div>
            <div className="details">
                <div className="title">
                    {isSent ? `Sent to ${shorten(tx.to)}` : `Received from ${shorten(tx.from)}`}
                </div>
                <div className="info">{new Date(tx.created_at).toLocaleString()}</div>
                {tx.memo && <div className="memo">"{tx.memo}"</div>}
            </div>
            <div className={`amount ${isSent ? 'sent' : 'received'}`}>
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
