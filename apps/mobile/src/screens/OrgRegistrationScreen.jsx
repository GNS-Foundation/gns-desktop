import React, { useState, useEffect } from 'react';
import './OrgRegistrationScreen.css';
import { checkOrgAvailability, registerOrg, verifyOrgDns } from "@gns/api-web";

export function OrgRegistrationScreen({ onBack }) {
    const [step, setStep] = useState('form'); // form, verify, success
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Form State
    const [namespace, setNamespace] = useState('');
    const [isAvailable, setIsAvailable] = useState(null);
    const [checking, setChecking] = useState(false);

    const [formData, setFormData] = useState({
        orgName: '',
        website: '',
        email: '',
        description: '',
        tier: 'starter'
    });

    // Verification State
    const [regData, setRegData] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const [verificationError, setVerificationError] = useState(null);

    // Check availability debounced
    useEffect(() => {
        const check = async () => {
            if (!namespace || namespace.length < 3) {
                setIsAvailable(null);
                return;
            }

            setChecking(true);
            const res = await checkOrgAvailability(namespace);
            // If API returns success:true but available:false -> taken
            // If API 404 (or specific available logic) -> available

            // Logic based on org.ts response:
            if (res.success && res.data?.available) {
                setIsAvailable(true);
            } else {
                setIsAvailable(false);
            }
            setChecking(false);
        };

        const timer = setTimeout(check, 500);
        return () => clearTimeout(timer);
    }, [namespace]);

    const handleRegister = async () => {
        if (!isAvailable) {
            setError('Namespace not available');
            return;
        }
        if (!formData.website.includes('.')) {
            setError('Valid website required for DNS verification');
            return;
        }

        setLoading(true);
        setError(null);

        const payload = {
            namespace,
            organization_name: formData.orgName,
            email: formData.email,
            website: formData.website,
            description: formData.description,
            tier: formData.tier
        };

        const res = await registerOrg(payload);

        if (res.success) {
            setRegData(res.data);
            setStep('verify');
        } else {
            setError(res.error || 'Registration failed');
        }
        setLoading(false);
    };

    const handleVerify = async () => {
        setVerifying(true);
        setVerificationError(null);

        // Verification relies on registration_id OR domain
        const res = await verifyOrgDns({
            registration_id: regData.registration_id,
            domain: regData.domain,
            verification_code: regData.verification_code
        });

        if (res.success && res.data?.verified) {
            setStep('success');
        } else {
            setVerificationError(res.data?.message || res.error || 'DNS record not found yet');
        }
        setVerifying(false);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // Could show toast here
    };

    if (step === 'verify') {
        return (
            <div className="org-registration-screen">
                <div className="org-header verify-mode">
                    <div style={{ fontSize: '48px' }}>🔐</div>
                    <h2>Verify Domain</h2>
                    <p>Add TXT record to prove ownership</p>
                </div>

                <div className="org-card">
                    <span className="org-label">DOMAIN TO VERIFY</span>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                        {regData?.domain}
                    </div>
                </div>

                <div className="org-label">STEP 1: ADD DNS TXT RECORD</div>
                <div className="org-card">
                    <div className="dns-record-box">
                        <div className="dns-field-label">Type</div>
                        <div className="dns-field-value">TXT</div>
                    </div>
                    <div className="dns-record-box">
                        <div className="dns-field-label">Host / Name</div>
                        <div className="dns-field-value">@ or {regData?.domain}</div>
                    </div>
                    <div className="dns-record-box">
                        <div className="dns-field-label">Value</div>
                        <div className="dns-field-value">
                            <span>gns-verify={regData?.verification_code}</span>
                            <span
                                className="copy-icon"
                                onClick={() => copyToClipboard(`gns-verify=${regData?.verification_code}`)}
                            >📋</span>
                        </div>
                    </div>
                </div>

                <div className="status-box warning">
                    <span>⚠️</span>
                    <div>DNS changes can take up to 24h to propagate.</div>
                </div>

                {verificationError && (
                    <div className="status-box error">
                        <span>❌</span>
                        <div>{verificationError}</div>
                    </div>
                )}

                <button
                    className="primary-btn"
                    onClick={handleVerify}
                    disabled={verifying}
                >
                    {verifying ? 'Checking DNS...' : 'Verify DNS Record'}
                </button>

                <button className="secondary-btn" onClick={() => setStep('form')}>
                    ← Back to form
                </button>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div className="org-registration-screen" style={{ textAlign: 'center', paddingTop: '100px' }}>
                <div style={{ fontSize: '80px', marginBottom: '20px' }}>🎉</div>
                <h2 style={{ fontSize: '28px', marginBottom: '10px' }}>Namespace Registered!</h2>
                <h3 style={{ color: '#8B5CF6', fontSize: '32px', marginBottom: '30px' }}>{namespace}@</h3>

                <div className="status-box success" style={{ display: 'inline-flex', marginBottom: '30px' }}>
                    Your organization namespace is active!
                </div>

                <button className="primary-btn" onClick={onBack}>
                    Return to Settings
                </button>
            </div>
        );
    }

    return (
        <div className="org-registration-screen">
            <div className="org-header">
                <div style={{ fontSize: '48px' }}>🏢</div>
                <h2>Register Organization</h2>
                <p>Claim your identity on GNS</p>
            </div>

            <div className="org-card">
                <div className="status-box neutral">
                    <span>ℹ️</span>
                    <div style={{ fontSize: '12px' }}>
                        <strong>DNS Verification Required:</strong> You will need to add a TXT record to your domain.
                    </div>
                </div>
            </div>

            <div className="org-label">NAMESPACE</div>
            <div className="org-input-group">
                <input
                    className="org-input"
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    placeholder="yourcompany"
                />
                <span className="input-suffix">@</span>
            </div>

            {namespace.length >= 3 && (
                <div className={`status-box ${checking ? 'neutral' : (isAvailable ? 'success' : 'error')}`}>
                    {checking ? 'Checking...' : (isAvailable ? '✅ Available' : '❌ Taken')}
                </div>
            )}

            <div className="org-label" style={{ marginTop: '20px' }}>ORGANIZATION DETAILS</div>
            <input
                className="org-input"
                placeholder="Organization Name"
                style={{ marginBottom: '12px' }}
                value={formData.orgName}
                onChange={e => setFormData({ ...formData, orgName: e.target.value })}
            />
            <input
                className="org-input"
                placeholder="Website (e.g. ulissy.app)"
                style={{ marginBottom: '12px' }}
                value={formData.website}
                onChange={e => setFormData({ ...formData, website: e.target.value })}
            />
            <input
                className="org-input"
                placeholder="Business Email"
                style={{ marginBottom: '12px' }}
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
            />

            <div className="org-label" style={{ marginTop: '20px' }}>SELECT PLAN</div>
            {['starter', 'team', 'business'].map(tier => (
                <div
                    key={tier}
                    className={`tier-card ${formData.tier === tier ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, tier })}
                >
                    <div className="tier-header">
                        <span className="tier-name" style={{ textTransform: 'capitalize' }}>{tier}</span>
                        {tier === 'starter' && <span className="tier-price">$49/yr</span>}
                        {tier === 'team' && <span className="tier-price">$149/yr</span>}
                        {tier === 'business' && <span className="tier-price">$299/yr</span>}
                    </div>
                </div>
            ))}

            {error && (
                <div className="status-box error" style={{ marginTop: '20px' }}>
                    {error}
                </div>
            )}

            <button
                className="primary-btn"
                onClick={handleRegister}
                disabled={loading || !isAvailable || !formData.orgName || !formData.website}
            >
                {loading ? 'Processing...' : 'Continue to Verification'}
            </button>
            <div style={{ height: '50px' }}></div>
        </div>
    );
}
