// ===========================================
// GNS BROWSER - QR LOGIN COMPONENT
// Secure pairing with mobile app
// 
// Location: src/components/QRLogin.jsx
// ===========================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Smartphone, Shield, RefreshCw, X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { GNS_API_BASE } from '../services/gnsApi';
import crypto from '../crypto';

// ===========================================
// QR LOGIN MODAL
// ===========================================

export function QRLoginModal({ isOpen, onClose, onSuccess, darkMode = false }) {
  const [status, setStatus] = useState('initializing'); // initializing, ready, polling, approved, rejected, expired, error
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const pollingRef = useRef(null);
  const timerRef = useRef(null);

  // Theme
  const theme = {
    bg: darkMode ? 'bg-gray-800' : 'bg-white',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textSecondary: darkMode ? 'text-gray-400' : 'text-gray-600',
    border: darkMode ? 'border-gray-700' : 'border-gray-200',
  };

  // Request new session
  const requestSession = useCallback(async () => {
    try {
      setStatus('initializing');
      setError(null);

      // Get browser info
      const browserInfo = `${navigator.userAgent.split(' ').slice(-2).join(' ')} on ${navigator.platform}`;

      // Generate browser's X25519 encryption keypair
      console.log('🔐 Generating browser encryption keys...');
      const browserKeys = await crypto.generateX25519Keypair();

      // Store temporarily in sessionStorage
      sessionStorage.setItem('gns_browser_encryption_public_key', browserKeys.publicKey);
      sessionStorage.setItem('gns_browser_encryption_private_key', browserKeys.privateKey);

      console.log('   ✅ Browser encryption keys generated');
      console.log('   🔑 Public key:', browserKeys.publicKey.substring(0, 16) + '...');

      const response = await fetch(`${GNS_API_BASE}/auth/sessions/request`, {
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
        setTimeLeft(data.data.expiresIn);
        setStatus('ready');
        startPolling(data.data.sessionId);
        startTimer(data.data.expiresIn);
      } else {
        throw new Error(data.error || 'Failed to create session');
      }
    } catch (err) {
      console.error('Session request error:', err);
      setError(err.message);
      setStatus('error');
    }
  }, []);

  // Poll for session approval
  const startPolling = useCallback((sessionId) => {
    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${GNS_API_BASE}/auth/sessions/${sessionId}`);
        const data = await response.json();

        if (!data.success) {
          if (response.status === 410) {
            setStatus('expired');
            stopPolling();
          }
          return;
        }

        const { status: sessionStatus } = data.data;

        if (sessionStatus === 'approved') {
          setStatus('approved');
          stopPolling();

          // Get browser's encryption keys from sessionStorage
          const browserEncryptionPrivateKey = sessionStorage.getItem('gns_browser_encryption_private_key');
          const browserEncryptionPublicKey = sessionStorage.getItem('gns_browser_encryption_public_key');

          // Save session and notify parent
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

          // Slight delay for animation
          setTimeout(() => {
            onSuccess(session);
          }, 1500);

        } else if (sessionStatus === 'rejected') {
          setStatus('rejected');
          stopPolling();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000); // Poll every 2 seconds
  }, [onSuccess]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Countdown timer
  const startTimer = useCallback((seconds) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setStatus('expired');
          stopPolling();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopPolling]);

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      requestSession();
    }
    return () => {
      stopPolling();
    };
  }, [isOpen, requestSession, stopPolling]);

  // Close handler
  const handleClose = () => {
    stopPolling();
    onClose();
  };

  // Retry handler
  const handleRetry = () => {
    stopPolling();
    requestSession();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className={`${theme.bg} rounded-3xl p-8 max-w-md w-full shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
              <Shield className="text-cyan-600" size={24} />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${theme.text}`}>Secure Sign In</h2>
              <p className={`${theme.textSecondary} text-sm`}>Scan with GNS Mobile App</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className={`p-2 hover:bg-gray-100 rounded-lg ${theme.textSecondary}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content based on status */}
        <div className="text-center">

          {/* Loading */}
          {status === 'initializing' && (
            <div className="py-12">
              <Loader2 size={48} className="text-cyan-500 animate-spin mx-auto mb-4" />
              <p className={theme.textSecondary}>Generating secure session...</p>
            </div>
          )}

          {/* QR Code Ready */}
          {(status === 'ready' || status === 'polling') && sessionData && (
            <>
              <div className={`bg-white p-4 rounded-2xl inline-block mb-6 border-4 ${theme.border}`}>
                <QRCodeSVG
                  value={sessionData.qrData}
                  size={200}
                  level="M"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>

              <div className={`flex items-center justify-center gap-2 mb-4 ${theme.textSecondary}`}>
                <Smartphone size={20} />
                <span>Open GNS App → Scan QR Code</span>
              </div>

              {/* Timer */}
              <div className={`text-sm ${timeLeft < 60 ? 'text-red-500' : theme.textSecondary}`}>
                Expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>

              {/* Waiting indicator */}
              <div className="mt-6 flex items-center justify-center gap-2 text-cyan-500">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                <span className="text-sm">Waiting for approval...</span>
              </div>
            </>
          )}

          {/* Approved */}
          {status === 'approved' && (
            <div className="py-12">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={48} className="text-green-600" />
              </div>
              <h3 className={`text-xl font-semibold ${theme.text} mb-2`}>Approved!</h3>
              <p className={theme.textSecondary}>Signing you in securely...</p>
            </div>
          )}

          {/* Rejected */}
          {status === 'rejected' && (
            <div className="py-12">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle size={48} className="text-red-600" />
              </div>
              <h3 className={`text-xl font-semibold ${theme.text} mb-2`}>Rejected</h3>
              <p className={`${theme.textSecondary} mb-6`}>The sign-in request was rejected on your mobile device.</p>
              <button
                onClick={handleRetry}
                className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white font-medium flex items-center gap-2 mx-auto"
              >
                <RefreshCw size={18} />
                Try Again
              </button>
            </div>
          )}

          {/* Expired */}
          {status === 'expired' && (
            <div className="py-12">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={48} className="text-yellow-600" />
              </div>
              <h3 className={`text-xl font-semibold ${theme.text} mb-2`}>Session Expired</h3>
              <p className={`${theme.textSecondary} mb-6`}>The QR code has expired. Please try again.</p>
              <button
                onClick={handleRetry}
                className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white font-medium flex items-center gap-2 mx-auto"
              >
                <RefreshCw size={18} />
                Generate New QR
              </button>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="py-12">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle size={48} className="text-red-600" />
              </div>
              <h3 className={`text-xl font-semibold ${theme.text} mb-2`}>Error</h3>
              <p className={`${theme.textSecondary} mb-6`}>{error || 'Something went wrong'}</p>
              <button
                onClick={handleRetry}
                className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white font-medium flex items-center gap-2 mx-auto"
              >
                <RefreshCw size={18} />
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Security notice */}
        {(status === 'ready' || status === 'polling') && (
          <div className={`mt-6 p-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-xl`}>
            <div className="flex items-start gap-3">
              <Shield size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
              <div className={`text-sm ${theme.textSecondary}`}>
                <strong className={theme.text}>Secure Pairing</strong>
                <p className="mt-1">
                  Your private keys never leave your mobile device.
                  This browser will receive a limited session token.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================
// AUTH SERVICE UPDATES
// Add these to src/services/auth.js
// ===========================================

export const QR_AUTH_FUNCTIONS = `
// ===========================================
// QR PAIRING AUTH
// ===========================================

const BROWSER_SESSION_KEY = 'gns_browser_session';

/**
 * Save verified browser session
 */
export function saveBrowserSession(session) {
  try {
    localStorage.setItem(BROWSER_SESSION_KEY, JSON.stringify(session));
    return true;
  } catch (e) {
    console.error('Failed to save browser session:', e);
    return false;
  }
}

/**
 * Get browser session
 */
export function getBrowserSession() {
  try {
    const stored = localStorage.getItem(BROWSER_SESSION_KEY);
    if (stored) {
      const session = JSON.parse(stored);
      // Check if session is verified (paired via QR)
      if (session.isVerified && session.sessionToken) {
        return session;
      }
    }
  } catch (e) {
    console.error('Failed to get browser session:', e);
  }
  return null;
}

/**
 * Check if browser is paired
 */
export function isPaired() {
  const session = getBrowserSession();
  return !!(session?.isVerified && session?.sessionToken);
}

/**
 * Get auth headers for paired session
 */
export function getPairedAuthHeaders() {
  const session = getBrowserSession();
  if (!session?.sessionToken) return {};
  
  return {
    'X-GNS-Session': session.sessionToken,
    'X-GNS-PublicKey': session.publicKey,
    'X-GNS-Timestamp': Date.now().toString(),
  };
}

/**
 * Clear browser session (logout)
 */
export function clearBrowserSession() {
  localStorage.removeItem(BROWSER_SESSION_KEY);
}
`;

export default QRLoginModal;
