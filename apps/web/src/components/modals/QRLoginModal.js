import React, { useState, useEffect, useRef } from 'react';
import { Shield, X, Loader2, Smartphone, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import crypto from '../../crypto';

// QR Login Modal Component
const QRLoginModal = ({ isOpen, onClose, onSuccess, darkMode }) => {
    const [status, setStatus] = useState('loading');
    const [sessionData, setSessionData] = useState(null);
    const [timeLeft, setTimeLeft] = useState(300);
    const [error, setError] = useState(null);
    const pollRef = useRef(null);
    const timerRef = useRef(null);

    const modalTheme = {
        bg: darkMode ? 'bg-gray-800' : 'bg-white',
        text: darkMode ? 'text-white' : 'text-gray-900',
        textMuted: darkMode ? 'text-gray-400' : 'text-gray-600',
        border: darkMode ? 'border-gray-700' : 'border-gray-200',
    };

    useEffect(() => {
        if (!isOpen) return;

        const requestSession = async () => {
            try {
                setStatus('loading');
                setError(null);

                const browserInfo = `${navigator.userAgent.split(' ').slice(-2).join(' ')}`;

                // Generate browser's X25519 encryption keypair
                console.log('🔐 Generating browser encryption keys...');
                const browserKeys = await crypto.generateX25519Keypair();

                // Store temporarily in sessionStorage
                sessionStorage.setItem('gns_browser_encryption_public_key', browserKeys.publicKey);
                sessionStorage.setItem('gns_browser_encryption_private_key', browserKeys.privateKey);

                console.log('   ✅ Browser encryption keys generated');
                console.log('   🔑 Public key:', browserKeys.publicKey.substring(0, 16) + '...');

                const response = await fetch('https://gns-browser-production.up.railway.app/auth/sessions/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        browserInfo,
                        browserEncryptionPublicKey: browserKeys.publicKey,  // Include in QR
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    setSessionData(data.data);
                    setTimeLeft(data.data.expiresIn || 300);
                    setStatus('ready');
                    startPolling(data.data.sessionId);
                    startTimer();
                } else {
                    setError(data.error || 'Failed to create session');
                    setStatus('error');
                }
            } catch (err) {
                console.error('QR session error:', err);
                setError(err.message);
                setStatus('error');
            }
        };

        requestSession();

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isOpen]);

    const startPolling = (sessionId) => {
        if (pollRef.current) clearInterval(pollRef.current);

        pollRef.current = setInterval(async () => {
            try {
                const response = await fetch(`https://gns-browser-production.up.railway.app/auth/sessions/${sessionId}`);
                const data = await response.json();

                if (!response.ok) {
                    if (response.status === 410) {
                        setStatus('expired');
                        clearInterval(pollRef.current);
                    }
                    return;
                }

                if (data.data?.status === 'approved') {
                    clearInterval(pollRef.current);
                    clearInterval(timerRef.current);
                    setStatus('approved');

                    setTimeout(() => {
                        // Get browser's encryption keys from sessionStorage
                        const browserEncryptionPrivateKey = sessionStorage.getItem('gns_browser_encryption_private_key');
                        const browserEncryptionPublicKey = sessionStorage.getItem('gns_browser_encryption_public_key');

                        const session = {
                            publicKey: data.data.publicKey,
                            handle: data.data.handle,

                            // Mobile's encryption key for dual encryption
                            encryptionKey: data.data.encryptionKey,

                            // Browser's encryption keys
                            encryptionPrivateKey: browserEncryptionPrivateKey,
                            encryptionPublicKey: browserEncryptionPublicKey,

                            sessionToken: data.data.sessionToken,
                            isVerified: true,
                            pairedAt: Date.now(),
                        };

                        // Clear sessionStorage keys (now in localStorage)
                        sessionStorage.removeItem('gns_browser_encryption_private_key');
                        sessionStorage.removeItem('gns_browser_encryption_public_key');

                        console.log('✅ QR login complete!');
                        console.log('   Mobile encryption key:', session.encryptionKey?.substring(0, 16) + '...');
                        console.log('   Browser encryption keys stored:', !!browserEncryptionPrivateKey);

                        localStorage.setItem('gns_browser_session', JSON.stringify(session));

                        // NEW: Store synced messages if provided
                        if (data.data.messageSync) {
                            localStorage.setItem('gns_message_sync', JSON.stringify(data.data.messageSync));
                        }

                        onSuccess(session, data.data.messageSync);  // Pass messageSync to handler
                    }, 1500);

                } else if (data.data?.status === 'rejected') {
                    clearInterval(pollRef.current);
                    clearInterval(timerRef.current);
                    setStatus('rejected');
                }
            } catch (err) {
                console.error('Poll error:', err);
            }
        }, 2000);
    };

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    setStatus('expired');
                    clearInterval(pollRef.current);
                    clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleRetry = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        setStatus('loading');
        setSessionData(null);
        setTimeLeft(300);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
            <div className={`${modalTheme.bg} rounded-3xl p-8 max-w-md w-full shadow-2xl`} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
                            <Shield className="text-cyan-600" size={24} />
                        </div>
                        <div>
                            <h2 className={`text-xl font-bold ${modalTheme.text}`}>Secure Sign In</h2>
                            <p className={`${modalTheme.textMuted} text-sm`}>Scan with GNS Mobile App</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`p-2 hover:bg-gray-100 rounded-lg ${modalTheme.textMuted}`}>
                        <X size={20} />
                    </button>
                </div>

                <div className="text-center">
                    {status === 'loading' && (
                        <div className="py-12">
                            <Loader2 size={48} className="text-cyan-500 animate-spin mx-auto mb-4" />
                            <p className={modalTheme.textMuted}>Generating secure session...</p>
                        </div>
                    )}

                    {status === 'ready' && sessionData && (
                        <>
                            <div className={`bg-white p-4 rounded-2xl inline-block mb-6 border-4 ${modalTheme.border}`}>
                                <QRCodeSVG value={sessionData.qrData} size={200} level="M" bgColor="#ffffff" fgColor="#000000" />
                            </div>
                            <div className={`flex items-center justify-center gap-2 mb-4 ${modalTheme.textMuted}`}>
                                <Smartphone size={20} />
                                <span>Open GNS App → Scan QR Code</span>
                            </div>
                            <div className={`text-sm ${timeLeft < 60 ? 'text-red-500' : modalTheme.textMuted}`}>
                                Expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </div>
                            <div className="mt-6 flex items-center justify-center gap-2 text-cyan-500">
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                                <span className="text-sm">Waiting for approval...</span>
                            </div>
                        </>
                    )}

                    {status === 'approved' && (
                        <div className="py-12">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check size={48} className="text-green-600" />
                            </div>
                            <h3 className={`text-xl font-semibold ${modalTheme.text} mb-2`}>Approved!</h3>
                            <p className={modalTheme.textMuted}>Signing you in securely...</p>
                        </div>
                    )}

                    {status === 'rejected' && (
                        <div className="py-12">
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <X size={48} className="text-red-600" />
                            </div>
                            <h3 className={`text-xl font-semibold ${modalTheme.text} mb-2`}>Rejected</h3>
                            <p className={`${modalTheme.textMuted} mb-6`}>Sign-in was rejected on mobile.</p>
                            <button onClick={handleRetry} className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white font-medium flex items-center gap-2 mx-auto">
                                <RefreshCw size={18} /> Try Again
                            </button>
                        </div>
                    )}

                    {(status === 'expired' || status === 'error') && (
                        <div className="py-12">
                            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle size={48} className="text-yellow-600" />
                            </div>
                            <h3 className={`text-xl font-semibold ${modalTheme.text} mb-2`}>{status === 'expired' ? 'Session Expired' : 'Error'}</h3>
                            <p className={`${modalTheme.textMuted} mb-6`}>{error || 'Please try again.'}</p>
                            <button onClick={handleRetry} className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white font-medium flex items-center gap-2 mx-auto">
                                <RefreshCw size={18} /> Try Again
                            </button>
                        </div>
                    )}
                </div>

                {status === 'ready' && (
                    <div className={`mt-6 p-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-xl`}>
                        <div className="flex items-start gap-3">
                            <Shield size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <div className={`text-sm ${modalTheme.textMuted}`}>
                                <strong className={modalTheme.text}>Secure Pairing</strong>
                                <p className="mt-1">Your private keys never leave your mobile device.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QRLoginModal;
