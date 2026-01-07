/**
 * Browser Pairing Screen - QR Scanner for Tauri Mobile
 * 
 * Scan QR codes from panthera.gcrumbs.com to pair browser sessions.
 * Uses html5-qrcode for camera access.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Monitor,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { getEncryptionKey, signString } from '../lib/tauri';

// ===========================================
// TYPES
// ===========================================

interface BrowserAuthRequest {
  sessionId: string;
  browserInfo: string;
  expiresAt: number;
  challenge: string;
  type: string;
}

// ===========================================
// API HELPERS
// ===========================================

const API_BASE = 'https://gns-browser-production.up.railway.app';

// Canonical JSON for signing (alphabetical keys)
function canonicalJson(obj: Record<string, any>): string {
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => {
    const val = obj[key];
    const valStr = typeof val === 'string' ? `"${val}"` : val;
    return `"${key}":${valStr}`;
  });
  return `{${pairs.join(',')}}`;
}

async function approveSession(
  payload: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/auth/sessions/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Approval failed' };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function rejectSession(payload: any): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/sessions/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Ignore errors on reject
  }
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function BrowserPairingScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'scanning' | 'confirm' | 'success' | 'error'>('scanning');
  const [request, setRequest] = useState<BrowserAuthRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Start countdown timer when request is received
  useEffect(() => {
    if (request && step === 'confirm') {
      const remaining = Math.max(0, request.expiresAt - Date.now());
      setTimeLeft(Math.floor(remaining / 1000));

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setError('Session expired');
            setStep('error');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [request, step]);

  // ===========================================
  // SCANNER FUNCTIONS
  // ===========================================

  const startScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        () => { } // Ignore scan failures
      );
    } catch (err) {
      console.error('Scanner error:', err);
      setError('Could not access camera. Please grant camera permission.');
      setStep('error');
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => { });
      scannerRef.current = null;
    }
  };

  const onScanSuccess = (decodedText: string) => {
    console.log('QR Scanned:', decodedText);

    // Parse the QR code
    const parsed = parseQRCode(decodedText);

    if (parsed) {
      stopScanner();
      setRequest(parsed);
      setStep('confirm');
    }
  };

  const parseQRCode = (data: string): BrowserAuthRequest | null => {
    try {
      const json = JSON.parse(data);
      if (json.sessionId && (json.type === 'gns_browser_auth' || json.type === 'browser_auth')) {
        return {
          sessionId: json.sessionId,
          browserInfo: json.browserInfo || 'Unknown Browser',
          expiresAt: json.expiresAt || Date.now() + 300000,
          challenge: json.challenge || '', // Essential for signing
          type: json.type,
        };
      }
    } catch {
      // Try URL format: gns://pair?session=xxx&challenge=xxx
      if (data.startsWith('gns://pair?')) {
        const url = new URL(data);
        const sessionId = url.searchParams.get('session');
        const browserInfo = url.searchParams.get('browser') || 'Unknown Browser';
        const challenge = url.searchParams.get('challenge') || '';

        if (sessionId) {
          return {
            sessionId,
            browserInfo,
            expiresAt: Date.now() + 300000,
            challenge,
            type: 'gns_browser_auth',
          };
        }
      }
    }
    return null;
  };

  // ===========================================
  // ACTION HANDLERS
  // ===========================================

  const handleApprove = async () => {
    if (!request || isProcessing) return;

    setIsProcessing(true);
    setError(null);

    const handle = localStorage.getItem('gns_handle');
    const publicKey = localStorage.getItem('gns_public_key');

    if (!handle || !publicKey) {
      setError('Identity not found. Please set up your identity first.');
      setIsProcessing(false);
      return;
    }

    try {
      // 1. Get encryption key for secure channel
      const encryptionKey = await getEncryptionKey();
      if (!encryptionKey) {
        throw new Error('Encryption key not found. Please ensure wallet is initialized.');
      }

      // 2. Prepare data to sign
      const signedData = {
        action: 'approve',
        challenge: request.challenge,
        publicKey: publicKey.toLowerCase(),
        sessionId: request.sessionId,
      };

      // 3. Sign the data
      const canonicalString = canonicalJson(signedData);
      const signature = await signString(canonicalString);

      if (!signature) {
        throw new Error('Failed to sign approval request.');
      }

      // 4. Send approval
      const payload = {
        sessionId: request.sessionId,
        publicKey,
        signature,
        deviceInfo: {
          platform: 'tauri-mobile', // TODO: Use getAppVersion platform?
          approvedAt: new Date().toISOString(),
        },
        encryptionKey,
        // messageSync handled separately later if needed
      };

      const result = await approveSession(payload);

      if (result.success) {
        setStep('success');
      } else {
        setError(result.error || 'Failed to approve session');
        setStep('error');
      }
    } catch (err) {
      console.error('Approval error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error during approval');
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!request) return;

    try {
      const publicKey = localStorage.getItem('gns_public_key');
      if (!publicKey) {
        navigate(-1);
        return;
      }

      const signedData = {
        action: 'reject',
        challenge: request.challenge,
        publicKey: publicKey.toLowerCase(),
        sessionId: request.sessionId,
      };

      const canonicalString = canonicalJson(signedData);
      const signature = await signString(canonicalString);

      if (signature) {
        await rejectSession({
          sessionId: request.sessionId,
          publicKey,
          signature,
        });
      }
    } catch (e) {
      console.error('Reject error:', e);
    }

    navigate(-1);
  };

  const handleRetry = () => {
    setRequest(null);
    setError(null);
    setStep('scanning');
    // Small delay before restarting scanner
    setTimeout(startScanner, 100);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ===========================================
  // RENDER
  // ===========================================

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
        >
          <X size={20} />
        </button>
        <h1 className="text-white font-semibold">Pair Browser</h1>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {step === 'scanning' && <ScannerView onMount={startScanner} />}
        {step === 'confirm' && request && (
          <ConfirmView
            request={request}
            timeLeft={timeLeft}
            isProcessing={isProcessing}
            onApprove={handleApprove}
            onReject={handleReject}
            onRetry={handleRetry}
            formatTime={formatTime}
          />
        )}
        {step === 'success' && <SuccessView onDone={() => navigate(-1)} />}
        {step === 'error' && (
          <ErrorView error={error} onRetry={handleRetry} onClose={() => navigate(-1)} />
        )}
      </div>
    </div>
  );
}

// ===========================================
// SCANNER VIEW
// ===========================================

function ScannerView({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Instructions */}
      <div className="px-6 py-4">
        <div className="bg-black/70 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Monitor size={20} className="text-cyan-400" />
            <span className="text-white font-semibold">Scan Browser QR Code</span>
          </div>
          <p className="text-gray-400 text-sm">
            Open panthera.gcrumbs.com on your computer and scan the login QR code
          </p>
        </div>
      </div>

      {/* QR Scanner */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="relative w-72 h-72">
          {/* Scanner container */}
          <div id="qr-reader" className="w-full h-full rounded-2xl overflow-hidden" />

          {/* Corner overlays */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-cyan-500 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-cyan-500 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-cyan-500 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-cyan-500 rounded-br-xl" />
          </div>
        </div>
      </div>

      {/* Security notice */}
      <div className="px-6 py-8">
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Shield size={20} className="text-cyan-400 mt-0.5" />
            <p className="text-cyan-100 text-sm">
              Your private keys stay on this device. Browser receives limited access only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// CONFIRM VIEW
// ===========================================

function ConfirmView({
  request,
  timeLeft,
  isProcessing,
  onApprove,
  onReject,
  onRetry,
  formatTime,
}: {
  request: BrowserAuthRequest;
  timeLeft: number;
  isProcessing: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRetry: () => void;
  formatTime: (s: number) => string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      {/* Browser icon */}
      <div className="w-24 h-24 rounded-full bg-cyan-500/20 flex items-center justify-center mb-8">
        <Monitor size={48} className="text-cyan-400" />
      </div>

      <h2 className="text-2xl font-bold text-white mb-4">Browser Sign-In Request</h2>

      {/* Browser info */}
      <div className="w-full bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
          <Monitor size={16} />
          <span>Browser</span>
        </div>
        <p className="text-white">{request.browserInfo}</p>

        <div className="flex items-center gap-2 text-gray-500 text-sm mt-4">
          <span>⏱️</span>
          <span className={timeLeft < 60 ? 'text-red-400' : ''}>
            Expires in {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* Warning */}
      <div className="w-full bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-8">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-orange-400 mt-0.5" />
          <p className="text-orange-200 text-sm">
            Only approve if you initiated this sign-in request
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="w-full flex gap-3">
        <button
          onClick={onReject}
          disabled={isProcessing}
          className="flex-1 py-4 border border-red-500 text-red-500 rounded-xl font-semibold hover:bg-red-500/10 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          onClick={onApprove}
          disabled={isProcessing}
          className="flex-[2] py-4 bg-cyan-500 text-white rounded-xl font-semibold hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              <CheckCircle size={20} />
              Approve
            </>
          )}
        </button>
      </div>

      <button onClick={onRetry} className="mt-4 text-gray-500 text-sm">
        Scan Different Code
      </button>
    </div>
  );
}

// ===========================================
// SUCCESS VIEW
// ===========================================

function SuccessView({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-6">
        <CheckCircle size={40} className="text-white" />
      </div>

      <h2 className="text-2xl font-bold text-white mb-2">Browser Approved!</h2>
      <p className="text-gray-400 text-center mb-8">
        Panthera Browser is now securely connected to your identity.
      </p>

      <button
        onClick={onDone}
        className="w-full max-w-xs py-4 bg-cyan-500 text-white rounded-xl font-semibold"
      >
        Done
      </button>
    </div>
  );
}

// ===========================================
// ERROR VIEW
// ===========================================

function ErrorView({
  error,
  onRetry,
  onClose,
}: {
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
        <AlertCircle size={40} className="text-red-500" />
      </div>

      <h2 className="text-xl font-bold text-white mb-2">Something Went Wrong</h2>
      <p className="text-gray-400 text-center mb-8">{error || 'An error occurred'}</p>

      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={onRetry}
          className="w-full py-4 bg-cyan-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <RefreshCw size={20} />
          Try Again
        </button>
        <button
          onClick={onClose}
          className="w-full py-4 border border-gray-600 text-gray-400 rounded-xl"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default BrowserPairingScreen;
