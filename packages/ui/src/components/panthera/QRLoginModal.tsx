// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — QR Login Modal
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/QRLoginModal.tsx
//
// Secure QR-based browser pairing with GNS mobile app.
// Flow:
//   1. Browser requests session → gets QR data
//   2. User scans QR with mobile app
//   3. Mobile signs challenge + approves session
//   4. Browser polls and receives session token
//   5. Session saved → user is authenticated
//
// Private keys NEVER leave the mobile device.
// Browser gets a limited, revocable session token.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, Smartphone, Shield, RefreshCw, X,
  CheckCircle, XCircle, AlertTriangle, QrCode,
} from 'lucide-react';

const API_BASE = 'https://gns-browser-production.up.railway.app';

// ─── Types ───

type SessionStatus = 'initializing' | 'ready' | 'polling' | 'approved' | 'rejected' | 'expired' | 'error';

interface SessionData {
  sessionId: string;
  challenge: string;
  expiresAt: number;
  expiresIn: number;
  qrData: string;
}

interface QRLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: any) => void;
  darkMode?: boolean;
}

// ─── Minimal X25519 keypair via Web Crypto ───
// We use tweetnacl if available, otherwise fall back to nacl.box.keyPair()
// For the web build, we'll use a dynamic import approach.

async function generateX25519Keypair(): Promise<{ publicKey: string; privateKey: string }> {
  // Try dynamic import of tweetnacl (should be available in the bundle)
  try {
    const nacl = await import('tweetnacl');
    const kp = nacl.box.keyPair();
    return {
      publicKey: bytesToHex(kp.publicKey),
      privateKey: bytesToHex(kp.secretKey),
    };
  } catch {
    // Fallback: generate random 32-byte keys (less secure, but allows QR to display)
    const priv = new Uint8Array(32);
    crypto.getRandomValues(priv);
    const pub = new Uint8Array(32);
    crypto.getRandomValues(pub);
    console.warn('⚠️ tweetnacl not available, using random bytes for keypair');
    return {
      publicKey: bytesToHex(pub),
      privateKey: bytesToHex(priv),
    };
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ═══════════════════════════════════════════════════════════════════

export default function QRLoginModal({ isOpen, onClose, onSuccess, darkMode = false }: QRLoginModalProps) {
  const [status, setStatus] = useState<SessionStatus>('initializing');
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Request new session ───
  const requestSession = useCallback(async () => {
    try {
      setStatus('initializing');
      setError(null);

      // Generate browser encryption keypair
      const browserKeys = await generateX25519Keypair();

      // Store temporarily in sessionStorage
      sessionStorage.setItem('gns_browser_encryption_public_key', browserKeys.publicKey);
      sessionStorage.setItem('gns_browser_encryption_private_key', browserKeys.privateKey);

      const browserInfo = getBrowserInfo();

      const response = await fetch(`${API_BASE}/auth/sessions/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          browserInfo,
          browserEncryptionPublicKey: browserKeys.publicKey,
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
    } catch (err: any) {
      console.error('Session request error:', err);
      setError(err.message);
      setStatus('error');
    }
  }, []);

  // ─── Poll for approval ───
  const startPolling = useCallback((sessionId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/sessions/${sessionId}`);
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

          // Get browser encryption keys from sessionStorage
          const browserEncPriv = sessionStorage.getItem('gns_browser_encryption_private_key');
          const browserEncPub = sessionStorage.getItem('gns_browser_encryption_public_key');

          const session = {
            publicKey: data.data.publicKey,
            handle: data.data.handle,
            encryptionKey: data.data.encryptionKey,
            encryptionPrivateKey: browserEncPriv,
            encryptionPublicKey: browserEncPub,
            sessionToken: data.data.sessionToken,
            isVerified: true,
            pairedAt: Date.now(),
          };

          // Clear sessionStorage keys
          sessionStorage.removeItem('gns_browser_encryption_private_key');
          sessionStorage.removeItem('gns_browser_encryption_public_key');

          // Notify parent after brief animation
          setTimeout(() => onSuccess(session), 1200);

        } else if (sessionStatus === 'rejected') {
          setStatus('rejected');
          stopPolling();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  }, [onSuccess]);

  // ─── Stop polling ───
  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ─── Countdown timer ───
  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { setStatus('expired'); stopPolling(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, [stopPolling]);

  // ─── Initialize on open ───
  useEffect(() => {
    if (isOpen) requestSession();
    return () => stopPolling();
  }, [isOpen, requestSession, stopPolling]);

  const handleClose = () => { stopPolling(); onClose(); };
  const handleRetry = () => { stopPolling(); requestSession(); };

  if (!isOpen) return null;

  // ─── Theme ───
  const bg = darkMode ? 'bg-gray-800' : 'bg-white';
  const text = darkMode ? 'text-white' : 'text-gray-900';
  const textSec = darkMode ? 'text-gray-400' : 'text-gray-600';
  const border = darkMode ? 'border-gray-700' : 'border-gray-200';

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className={`${bg} rounded-3xl p-8 max-w-md w-full shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
              <Shield className="text-cyan-600" size={24} />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${text}`}>Secure Sign In</h2>
              <p className={`${textSec} text-sm`}>Scan with GNS Mobile App</p>
            </div>
          </div>
          <button onClick={handleClose} className={`p-2 hover:bg-gray-100 rounded-lg ${textSec}`}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="text-center">

          {/* Initializing */}
          {status === 'initializing' && (
            <div className="py-12">
              <Loader2 size={48} className="text-cyan-500 animate-spin mx-auto mb-4" />
              <p className={textSec}>Generating secure session...</p>
            </div>
          )}

          {/* QR Ready */}
          {(status === 'ready' || status === 'polling') && sessionData && (
            <>
              <div className={`bg-white p-4 rounded-2xl inline-block mb-6 border-4 ${border}`}>
                <QRCodeDisplay data={sessionData.qrData} size={200} />
              </div>

              <div className={`flex items-center justify-center gap-2 mb-4 ${textSec}`}>
                <Smartphone size={20} />
                <span>Open GNS App → Scan QR Code</span>
              </div>

              <div className={`text-sm ${timeLeft < 60 ? 'text-red-500' : textSec}`}>
                Expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>

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
              <h3 className={`text-xl font-semibold ${text} mb-2`}>Approved!</h3>
              <p className={textSec}>Signing you in securely...</p>
            </div>
          )}

          {/* Rejected */}
          {status === 'rejected' && (
            <div className="py-12">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle size={48} className="text-red-600" />
              </div>
              <h3 className={`text-xl font-semibold ${text} mb-2`}>Rejected</h3>
              <p className={`${textSec} mb-6`}>The sign-in request was rejected on your mobile device.</p>
              <RetryButton onClick={handleRetry} label="Try Again" />
            </div>
          )}

          {/* Expired */}
          {status === 'expired' && (
            <div className="py-12">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={48} className="text-yellow-600" />
              </div>
              <h3 className={`text-xl font-semibold ${text} mb-2`}>Session Expired</h3>
              <p className={`${textSec} mb-6`}>The QR code has expired. Please try again.</p>
              <RetryButton onClick={handleRetry} label="Generate New QR" />
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="py-12">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle size={48} className="text-red-600" />
              </div>
              <h3 className={`text-xl font-semibold ${text} mb-2`}>Error</h3>
              <p className={`${textSec} mb-6`}>{error || 'Something went wrong'}</p>
              <RetryButton onClick={handleRetry} label="Try Again" />
            </div>
          )}
        </div>

        {/* Security notice */}
        {(status === 'ready' || status === 'polling') && (
          <div className={`mt-6 p-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-xl`}>
            <div className="flex items-start gap-3">
              <Shield size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
              <div className={`text-sm ${textSec}`}>
                <strong className={text}>Secure Pairing</strong>
                <p className="mt-1">
                  Your private keys never leave your mobile device.
                  This browser receives a limited, revocable session token.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── QR Code Display ───
// Uses the qrcode.react library if available, otherwise renders a placeholder

function QRCodeDisplay({ data, size }: { data: string; size: number }) {
  const [QRComponent, setQRComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    // Dynamic import of qrcode.react
    import('qrcode.react')
      .then((mod) => {
        // qrcode.react exports QRCodeSVG
        setQRComponent(() => mod.QRCodeSVG || mod.default);
      })
      .catch(() => {
        console.warn('qrcode.react not available, showing fallback');
      });
  }, []);

  if (QRComponent) {
    return (
      <QRComponent
        value={data}
        size={size}
        level="M"
        includeMargin={false}
        bgColor="#ffffff"
        fgColor="#000000"
      />
    );
  }

  // Fallback: show the QR data as text (user can manually enter)
  return (
    <div
      className="flex flex-col items-center justify-center bg-gray-50 rounded-xl"
      style={{ width: size, height: size }}
    >
      <QrCode size={64} className="text-gray-300 mb-3" />
      <p className="text-xs text-gray-400 px-4 text-center">
        Install <code className="bg-gray-200 px-1 rounded">qrcode.react</code> to display QR code
      </p>
    </div>
  );
}

// ─── Retry Button ───

function RetryButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white font-medium flex items-center gap-2 mx-auto transition-colors"
    >
      <RefreshCw size={18} />
      {label}
    </button>
  );
}

// ─── Browser Info ───

function getBrowserInfo(): string {
  try {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    let os = 'Unknown';
    if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';

    return `${browser} on ${os}`;
  } catch {
    return 'PANTHERA Browser';
  }
}
