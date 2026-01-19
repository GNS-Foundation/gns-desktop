import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStellar } from '../hooks/useStellar';
import './SendMoneyScreen.css';

export function SendMoneyScreen() {
    const navigate = useNavigate();
    const { sendGns, loading } = useStellar();

    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [memo, setMemo] = useState('');
    const [status, setStatus] = useState(null); // success, error

    const handleSend = async (e) => {
        e.preventDefault();
        try {
            await sendGns(recipient, amount, memo);
            setStatus({ type: 'success', message: 'Transaction Sent!' });
            setTimeout(() => navigate(-1), 1500);
        } catch (err) {
            setStatus({ type: 'error', message: err.message });
        }
    };

    return (
        <div className="send-money-screen">
            <header className="send-header">
                <button className="close-btn" onClick={() => navigate(-1)}>✕</button>
                <h2>Send Money</h2>
            </header>

            <form className="send-form" onSubmit={handleSend}>
                <div className="amount-input-container">
                    <span className="currency-symbol">€</span>
                    <input
                        type="number"
                        className="amount-input"
                        placeholder="0.00"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        required
                        min="0.01"
                        step="0.01"
                    />
                </div>

                <div className="input-group">
                    <label>To</label>
                    <input
                        type="text"
                        placeholder="@handle or GNS Key"
                        value={recipient}
                        onChange={e => setRecipient(e.target.value)}
                        required
                    />
                </div>

                <div className="input-group">
                    <label>Memo (Optional)</label>
                    <input
                        type="text"
                        placeholder="What's this for?"
                        value={memo}
                        onChange={e => setMemo(e.target.value)}
                    />
                </div>

                {status && (
                    <div className={`status-message ${status.type}`}>
                        {status.message}
                    </div>
                )}

                <button
                    type="submit"
                    className="send-btn"
                    disabled={loading || !amount || !recipient}
                >
                    {loading ? 'Sending...' : 'Send Payment'}
                </button>
            </form>
        </div>
    );
}
