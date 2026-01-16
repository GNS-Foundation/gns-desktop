import React, { useState } from 'react';
import { usePayments } from '../hooks/usePayments';
import { useBreadcrumbs } from '../hooks/useBreadcrumbs';
import './HistoryTab.css';

export function HistoryTab() {
    const [filter, setFilter] = useState('all'); // 'all', 'payments', 'breadcrumbs'
    const { transactions } = usePayments();
    const { status } = useBreadcrumbs();

    const breadcrumbCount = status?.count || 0;

    const renderTransactions = () => {
        if (!transactions || transactions.length === 0) {
            return (
                <div className="empty-state">
                    <div className="empty-icon">📜</div>
                    <h2>No transactions yet</h2>
                    <p>Your payment history will appear here</p>
                </div>
            );
        }

        return (
            <div className="transaction-list">
                {transactions.map((tx, index) => (
                    <div key={index} className="transaction-card">
                        <div className={`tx-icon ${tx.type}`}>
                            {tx.type === 'sent' ? '↑' : '↓'}
                        </div>
                        <div className="tx-info">
                            <div className="tx-label">{tx.label}</div>
                            <div className="tx-date">{new Date(tx.date).toLocaleDateString()}</div>
                        </div>
                        <div className={`tx-amount ${tx.type}`}>
                            {tx.type === 'sent' ? '-' : '+'}€{tx.amount.toFixed(2)}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderBreadcrumbs = () => {
        return (
            <div className="breadcrumb-history">
                <div className="breadcrumb-summary-card">
                    <div className="summary-icon">🍞</div>
                    <div className="summary-info">
                        <div className="summary-label">Total Breadcrumbs</div>
                        <div className="summary-value">{breadcrumbCount}</div>
                    </div>
                </div>
                <p className="info-text">Breadcrumbs build your identity through movement</p>
            </div>
        );
    };

    return (
        <div className="history-tab">
            <header className="history-header">
                <h1>HISTORY</h1>
            </header>

            <div className="filter-tabs">
                <button
                    className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All
                </button>
                <button
                    className={`filter-tab ${filter === 'payments' ? 'active' : ''}`}
                    onClick={() => setFilter('payments')}
                >
                    Payments
                </button>
                <button
                    className={`filter-tab ${filter === 'breadcrumbs' ? 'active' : ''}`}
                    onClick={() => setFilter('breadcrumbs')}
                >
                    Breadcrumbs
                </button>
            </div>

            <div className="history-content">
                {filter === 'breadcrumbs' && renderBreadcrumbs()}
                {(filter === 'all' || filter === 'payments') && renderTransactions()}
            </div>
        </div>
    );
}
