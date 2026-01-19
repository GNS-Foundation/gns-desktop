import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react'; // User must install this: npm install qrcode.react
import './MerchantScreen.css';

const MOCK_MERCHANT = {
    handle: 'cafe_rome',
    name: 'Caffè Roma',
    location: 'Rome, Italy',
    verified: true
};

export function MerchantScreen({ onBack }) {
    const [amount, setAmount] = useState('10.00');
    const [currency, setCurrency] = useState('EUR');
    const [memo, setMemo] = useState('');
    const [status, setStatus] = useState('idle'); // idle, waiting, verifying, success
    const [transactions, setTransactions] = useState([]);

    // Mock Challenge Data
    const [challenge, setChallenge] = useState(null);

    const handleCharge = () => {
        if (!amount || parseFloat(amount) <= 0) return;

        const newChallenge = {
            id: `ch_${Date.now()}`,
            amount: parseFloat(amount),
            currency,
            memo,
            merchant: MOCK_MERCHANT.handle,
            timestamp: new Date().toISOString()
        };

        setChallenge(newChallenge);
        setStatus('waiting');
    };

    const handleMockTap = () => {
        setStatus('verifying');
        setTimeout(() => {
            const newTx = {
                id: `tx_${Date.now()}`,
                amount: challenge.amount,
                currency: challenge.currency,
                customer: 'gns_user_77', // Mock customer
                timestamp: new Date()
            };
            setTransactions([newTx, ...transactions]);
            setStatus('success');
        }, 2000);
    };

    const handleReset = () => {
        setChallenge(null);
        setMemo('');
        setStatus('idle');
    };

    return (
        <div className="merchant-screen">
            <header className="merchant-app-bar">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button className="back-btn" onClick={onBack}>←</button>
                    <h1>Merchant Terminal</h1>
                </div>
                <button className="history-btn" onClick={() => alert('Transactions log coming soon')}>
                    📋
                </button>
            </header>

            <div className="merchant-content">
                {/* Merchant Info Card */}
                <div className="merchant-card">
                    <div className="store-icon">🏪</div>
                    <div className="merchant-info">
                        <h2>{MOCK_MERCHANT.name}</h2>
                        <div className="nfc-status">
                            <span style={{ color: '#10b981' }}>●</span> NFC Reader Active
                        </div>
                    </div>
                </div>

                {/* Main Display */}
                {status === 'idle' && (
                    <>
                        <div className="terminal-display">
                            <span className="currency-symbol" style={{ color: '#34d399', fontSize: '32px' }}>
                                {currency === 'EUR' ? '€' : '$'}
                            </span>
                            {amount ? (
                                <span className="amount-display">{amount}</span>
                            ) : (
                                <span className="placeholder-text">0.00</span>
                            )}
                        </div>

                        <div className="input-section">
                            <div className="amount-input-group">
                                <label>Amount</label>
                                <div className="amount-field">
                                    <span className="currency-symbol">{currency === 'EUR' ? '€' : '$'}</span>
                                    <input
                                        type="number"
                                        className="amount-input"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="currency-selector">
                                {['EUR', 'USD'].map(c => (
                                    <button
                                        key={c}
                                        className={`currency-chip ${currency === c ? 'selected' : ''}`}
                                        onClick={() => setCurrency(c)}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>

                            <input
                                type="text"
                                className="memo-input"
                                placeholder="Add a note (optional)"
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                            />

                            <button className="charge-btn" onClick={handleCharge}>
                                <span>⚡</span> CHARGE
                            </button>
                        </div>
                    </>
                )}

                {status === 'waiting' && (
                    <div className="waiting-container">
                        <div className="nfc-pulse" onClick={handleMockTap} style={{ cursor: 'pointer' }} title="Click to simulate NFC Tap">
                            <span style={{ fontSize: '48px' }}>📡</span>
                        </div>

                        <h2 className="waiting-title">Waiting for Payment</h2>
                        <p className="waiting-subtitle">Tap phone to pay {currency === 'EUR' ? '€' : '$'}{amount}</p>

                        <div className="qr-section">
                            <div className="qr-label">Or scan to pay</div>
                            {/* Fallback if library missing, user needs to ensure it's installed */}
                            <QRCodeSVG value={JSON.stringify(challenge)} size={180} />
                        </div>

                        <button className="cancel-btn" onClick={handleReset}>Cancel</button>
                        <div style={{ marginTop: '20px', fontSize: '12px', color: '#9ca3af' }}>
                            (Dev: Click the antenna icon to simulate tap)
                        </div>
                    </div>
                )}

                {status === 'verifying' && (
                    <div className="waiting-container" style={{ justifyContent: 'center', height: '100%' }}>
                        <div className="nfc-pulse" style={{ animation: 'none', border: 'none' }}>
                            <div className="spinner">⏳</div>
                        </div>
                        <h2>Verifying...</h2>
                    </div>
                )}

                {status === 'success' && (
                    <div className="success-container">
                        <div className="success-icon">✓</div>
                        <h2>Payment Complete!</h2>
                        <div className="success-amount">
                            {currency === 'EUR' ? '€' : '$'}{amount}
                        </div>
                        <p style={{ color: '#6b7280' }}>Transaction ID: {transactions[0]?.id.slice(-6)}</p>

                        <button className="new-tx-btn" onClick={handleReset}>
                            New Transaction
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
