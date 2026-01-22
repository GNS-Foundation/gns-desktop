import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaymentLinks } from '../hooks/usePaymentLinks';
import './PaymentLinksScreen.css';

export function PaymentLinksScreen() {
    const navigate = useNavigate();
    const { links, loading, error, createLink, deactivateLink } = usePaymentLinks();
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('EUR');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !amount) return;

        setSubmitting(true);
        try {
            await createLink({
                title,
                amount: parseFloat(amount),
                currency,
                description,
                type: 'reusable' // Default to reusable for PayPage usage
            });
            setShowModal(false);
            // Reset form
            setTitle('');
            setAmount('');
            setDescription('');
        } catch (err) {
            alert('Failed to create link: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCopy = (code) => {
        const url = `https://panthera.gcrumbs.com/pay/${code}`;
        navigator.clipboard.writeText(url);
        // Could show a toast here
    };

    return (
        <div className="payment-links-screen">
            <header className="pl-header">
                <button className="pl-back-btn" onClick={() => navigate(-1)}>←</button>
                <h2 className="pl-title">Payment Links</h2>
                <div style={{ width: 40 }} />
            </header>

            <div className="pl-content">
                {loading && !links.length ? (
                    <div className="pl-loading">Loading links...</div>
                ) : error ? (
                    <div className="pl-loading">{error}</div>
                ) : links.length === 0 ? (
                    <div className="pl-loading">No payment links yet. Create one!</div>
                ) : (
                    links.map(link => (
                        <div key={link.id} className="link-card">
                            <div className="link-card-header">
                                <div className="link-title">{link.title}</div>
                                <div className={`link-status ${link.status}`}>
                                    {link.status}
                                </div>
                            </div>

                            <div className="link-url-container">
                                <div className="link-url">
                                    https://panthera.gcrumbs.com/pay/{link.code}
                                </div>
                                <button className="copy-btn" onClick={() => handleCopy(link.code)}>
                                    📋
                                </button>
                            </div>

                            <div className="link-stats">
                                <div className="stat-item">
                                    💰 {link.currency} {link.amount}
                                </div>
                                <div className="stat-item">
                                    👁️ {link.paymentCount || 0} payments
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <button className="pl-fab" onClick={() => setShowModal(true)}>+</button>

            {showModal && (
                <div className="pl-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="pl-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">New Payment Link</div>
                            <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Link Title</label>
                                <input
                                    className="form-input"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g. Weekly Coaching"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Amount</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    step="0.01"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description (Optional)</label>
                                <input
                                    className="form-input"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="What is this for?"
                                />
                            </div>

                            <button
                                type="submit"
                                className="submit-btn"
                                disabled={submitting}
                            >
                                {submitting ? 'Creating...' : 'Create Link'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
