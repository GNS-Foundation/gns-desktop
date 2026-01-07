/**
 * Welcome Screen - Platform-Aware Identity Flow
 * 
 * - Mobile (Tauri): Create identity locally → Claim handle
 * - Web (Browser): Show QR code → Scan with mobile app to pair
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe,
  Key,
  MapPin,
  MessageCircle,
  Shield,
  ArrowRight,
  Smartphone,
  QrCode,
  Loader2,
  RefreshCw,
  Check,
  AlertCircle,
} from 'lucide-react';

// ===========================================
// PLATFORM DETECTION
// ===========================================

function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// ===========================================
// PROPS
// ===========================================

interface WelcomeScreenProps {
  onComplete: () => void;
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [step, setStep] = useState<'welcome' | 'create' | 'qr-login'>('welcome');
  const isMobile = isTauriApp();

  // Welcome step
  if (step === 'welcome') {
    return (
      <WelcomeStep 
        onGetStarted={() => setStep(isMobile ? 'create' : 'qr-login')}
        isMobile={isMobile}
      />
    );
  }

  // QR Login (Web only)
  if (step === 'qr-login') {
    return (
      <QRLoginStep 
        onSuccess={onComplete}
        onBack={() => setStep('welcome')}
      />
    );
  }

  // Handle claim (Mobile only)
  return (
    <HandleClaimStep 
      onComplete={onComplete}
      onBack={() => setStep('welcome')}
    />
  );
}

// ===========================================
// WELCOME STEP
// ===========================================

function WelcomeStep({ 
  onGetStarted, 
  isMobile 
}: { 
  onGetStarted: () => void;
  isMobile: boolean;
}) {
  const features = [
    {
      icon: <Key className="text-blue-400" size={24} />,
      title: 'Own Your Identity',
      description: 'One cryptographic key for everything',
    },
    {
      icon: <MapPin className="text-blue-400" size={24} />,
      title: 'Prove Your Humanity',
      description: 'No biometrics, just your trajectory',
    },
    {
      icon: <MessageCircle className="text-blue-400" size={24} />,
      title: 'Encrypted Messaging',
      description: 'End-to-end encrypted by default',
    },
    {
      icon: <Shield className="text-blue-400" size={24} />,
      title: 'No Passwords',
      description: 'Your device is your authenticator',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0D1117] flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-8 shadow-lg shadow-blue-500/20">
        <Globe size={48} className="text-white" />
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-white mb-2">Gcrumbs</h1>
      <p className="text-gray-400 mb-8">Your decentralized identity</p>

      {/* Features */}
      <div className="w-full max-w-sm space-y-4 mb-8">
        {features.map((feature, index) => (
          <div key={index} className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              {feature.icon}
            </div>
            <div>
              <h3 className="text-white font-medium">{feature.title}</h3>
              <p className="text-gray-500 text-sm">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <button
        onClick={onGetStarted}
        className="w-full max-w-sm py-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        {isMobile ? (
          <>Get Started <ArrowRight size={20} /></>
        ) : (
          <>
            <QrCode size={20} />
            Connect with Mobile App
          </>
        )}
      </button>

      {/* Platform hint */}
      <p className="text-gray-600 text-sm mt-4 text-center">
        {isMobile 
          ? "Create your identity on this device"
          : "Scan QR code with your GNS mobile app"
        }
      </p>
    </div>
  );
}

// ===========================================
// QR LOGIN STEP (WEB ONLY)
// ===========================================

const API_BASE = 'https://gns-browser-production.up.railway.app';

interface SessionData {
  sessionId: string;
  qrData: string;
  expiresIn: number;
}

function QRLoginStep({ 
  onSuccess, 
  onBack 
}: { 
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'approved' | 'expired' | 'error'>('loading');
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [error, setError] = useState<string | null>(null);
  
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    requestSession();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const requestSession = async () => {
    setStatus('loading');
    setError(null);

    try {
      const browserInfo = navigator.userAgent.split(' ').slice(-2).join(' ');
      
      const response = await fetch(`${API_BASE}/auth/sessions/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ browserInfo }),
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
      setError(String(err));
      setStatus('error');
    }
  };

  const startPolling = (sessionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/sessions/${sessionId}`);
        
        if (!response.ok) {
          if (response.status === 410) {
            setStatus('expired');
            clearInterval(pollRef.current!);
          }
          return;
        }

        const data = await response.json();

        if (data.data?.status === 'approved') {
          clearInterval(pollRef.current!);
          clearInterval(timerRef.current!);
          setStatus('approved');

          // Store session data
          if (data.data.handle) {
            localStorage.setItem('gns_handle', data.data.handle);
          }
          if (data.data.publicKey) {
            localStorage.setItem('gns_public_key', data.data.publicKey);
          }
          if (data.data.sessionToken) {
            localStorage.setItem('gns_session_token', data.data.sessionToken);
          }

          // Small delay then complete
          setTimeout(() => {
            onSuccess();
          }, 1500);
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
          clearInterval(timerRef.current!);
          clearInterval(pollRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#0D1117] flex flex-col items-center justify-center p-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 text-gray-400 hover:text-white flex items-center gap-2"
      >
        ← Back
      </button>

      {/* Title */}
      <h1 className="text-2xl font-bold text-white mb-2">Connect Your Identity</h1>
      <p className="text-gray-400 mb-8 text-center">
        Scan this QR code with your GNS mobile app
      </p>

      {/* QR Code Area */}
      <div className="w-72 h-72 bg-white rounded-2xl p-4 mb-6 flex items-center justify-center">
        {status === 'loading' && (
          <Loader2 size={48} className="text-gray-400 animate-spin" />
        )}

        {status === 'ready' && sessionData && (
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(sessionData.qrData)}`}
            alt="QR Code"
            className="w-full h-full"
          />
        )}

        {status === 'approved' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-white" />
            </div>
            <p className="text-green-600 font-semibold">Connected!</p>
          </div>
        )}

        {status === 'expired' && (
          <div className="text-center">
            <AlertCircle size={48} className="text-orange-500 mx-auto mb-4" />
            <p className="text-gray-600">QR code expired</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Timer / Refresh */}
      {status === 'ready' && (
        <p className="text-gray-500 text-sm mb-4">
          Expires in {formatTime(timeLeft)}
        </p>
      )}

      {(status === 'expired' || status === 'error') && (
        <button
          onClick={requestSession}
          className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
        >
          <RefreshCw size={18} />
          Generate New QR Code
        </button>
      )}

      {/* Instructions */}
      <div className="mt-8 max-w-sm">
        <h3 className="text-white font-semibold mb-3 text-center">How to connect:</h3>
        <ol className="text-gray-400 text-sm space-y-2">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 text-xs">1</span>
            <span>Open the GNS Browser app on your phone</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 text-xs">2</span>
            <span>Go to Settings → Browser Pairing</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 text-xs">3</span>
            <span>Scan this QR code to connect</span>
          </li>
        </ol>
      </div>

      {/* Don't have app */}
      <div className="mt-8 text-center">
        <p className="text-gray-600 text-sm">Don't have the app?</p>
        <a 
          href="https://gcrumbs.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-400 text-sm hover:underline"
        >
          Download GNS Browser →
        </a>
      </div>
    </div>
  );
}

// ===========================================
// HANDLE CLAIM STEP (MOBILE ONLY)
// ===========================================

function HandleClaimStep({ 
  onComplete, 
  onBack 
}: { 
  onComplete: () => void;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const [handle, setHandle] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [isCreating, setIsCreating] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const checkHandle = async (value: string) => {
    if (value.length < 3) {
      setStatus('idle');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(value)) {
      setStatus('invalid');
      return;
    }

    setStatus('checking');

    try {
      const response = await fetch(
        `https://gns-browser-production.up.railway.app/handles/check/${value}`
      );
      const data = await response.json();
      
      setStatus(data.available ? 'available' : 'taken');
    } catch (err) {
      console.error('Handle check error:', err);
      setStatus('idle');
    }
  };

  const handleInputChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setHandle(cleaned);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => checkHandle(cleaned), 500);
  };

  const handleCreate = async () => {
    if (status !== 'available') return;
    
    setIsCreating(true);

    try {
      // Create identity via Tauri
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('create_identity', { handle });
      
      localStorage.setItem('gns_handle', handle);
      onComplete();
    } catch (err) {
      console.error('Create identity error:', err);
      alert('Failed to create identity: ' + String(err));
    } finally {
      setIsCreating(false);
    }
  };

  const requirements = [
    { met: handle.length >= 3 && handle.length <= 20, text: '3-20 characters' },
    { met: /^[a-z0-9_]*$/.test(handle), text: 'Letters, numbers, underscore only' },
    { met: status === 'available', text: 'Available on network' },
  ];

  return (
    <div className="min-h-screen bg-[#0D1117] p-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="text-gray-400 hover:text-white flex items-center gap-2 mb-8"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-bold text-white mb-2">Choose your handle</h1>
      <p className="text-gray-400 mb-8">
        This will be your unique identity on the network. Choose wisely - it's permanent once claimed!
      </p>

      {/* Handle input */}
      <div className="relative mb-6">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">@</span>
        <input
          type="text"
          value={handle}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="yourhandle"
          maxLength={20}
          className="w-full pl-10 pr-12 py-4 bg-[#161B22] border-2 border-blue-500/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        {status === 'checking' && (
          <Loader2 size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
        )}
        {status === 'available' && (
          <Check size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" />
        )}
      </div>

      {/* Requirements */}
      <div className="bg-[#161B22] rounded-xl p-4 mb-8">
        <p className="text-gray-500 text-sm mb-3">REQUIREMENTS</p>
        {requirements.map((req, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <div className={`w-4 h-4 rounded-full border-2 ${req.met ? 'border-green-500 bg-green-500' : 'border-gray-600'}`}>
              {req.met && <Check size={10} className="text-white m-auto" />}
            </div>
            <span className={req.met ? 'text-gray-300' : 'text-gray-500'}>{req.text}</span>
          </div>
        ))}
      </div>

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={status !== 'available' || isCreating}
        className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        {isCreating ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Creating...
          </>
        ) : (
          <>Create Identity</>
        )}
      </button>
    </div>
  );
}

export default WelcomeScreen;
