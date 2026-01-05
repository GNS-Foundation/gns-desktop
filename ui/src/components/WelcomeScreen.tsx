/**
 * WelcomeScreen - New User Onboarding with Handle Reservation
 * 
 * Flow:
 * 1. User enters desired @handle
 * 2. Real-time validation (3-20 chars, alphanumeric + underscore)
 * 3. Debounced availability check on network
 * 4. Create identity + reserve handle
 * 5. Navigate to main app (breadcrumb collection)
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { KeyRound, MapPin, MessageCircle, Shield } from 'lucide-react';

// Types for handle reservation flow
interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface HandleCheckResult {
  handle: string;
  available: boolean;
  reason?: string;
}

interface CreateIdentityResult {
  public_key: string;
  encryption_key: string;
  gns_id: string;
  handle: string;
  network_reserved: boolean;
  message: string;
}

type ValidationState = 'idle' | 'typing' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';

interface WelcomeScreenProps {
  onComplete: () => void;
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [step, setStep] = useState<'intro' | 'handle'>('intro');
  const [handle, setHandle] = useState('');
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationMessage, setValidationMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [checkTimer, setCheckTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Validate handle format locally
  const validateFormat = useCallback((value: string): { valid: boolean; message: string } => {
    const clean = value.trim().toLowerCase().replace('@', '');

    if (clean.length === 0) {
      return { valid: false, message: '' };
    }

    if (clean.length < 3) {
      return { valid: false, message: 'At least 3 characters needed' };
    }

    if (clean.length > 20) {
      return { valid: false, message: 'Maximum 20 characters' };
    }

    if (!/^[a-z0-9_]+$/.test(clean)) {
      return { valid: false, message: 'Only letters, numbers, and underscore' };
    }

    const reserved = ['admin', 'root', 'system', 'gns', 'support', 'help', 'echo', 'bot'];
    if (reserved.includes(clean)) {
      return { valid: false, message: 'This handle is reserved' };
    }

    return { valid: true, message: '' };
  }, []);

  // Check availability on network
  const checkAvailability = useCallback(async (value: string) => {
    const clean = value.trim().toLowerCase().replace('@', '');

    try {
      setValidationState('checking');
      setValidationMessage('Checking availability...');

      const result = await invoke<CommandResult<HandleCheckResult>>('check_handle_available', {
        handle: clean
      });

      if (result.success && result.data) {
        if (result.data.available) {
          setValidationState('available');
          setValidationMessage(`@${clean} is available! ✓`);
        } else {
          setValidationState('taken');
          setValidationMessage(result.data.reason || `@${clean} is already taken`);
        }
      } else {
        setValidationState('error');
        setValidationMessage(result.error || 'Could not check availability');
      }
    } catch (err) {
      setValidationState('error');
      setValidationMessage('Network error - try again');
      console.error('Availability check failed:', err);
    }
  }, []);

  // Handle input change with debounced availability check
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setHandle(value);
    setCreateError(null);

    if (checkTimer) {
      clearTimeout(checkTimer);
    }

    const { valid, message } = validateFormat(value);

    if (!valid) {
      setValidationState(value.length > 0 ? 'invalid' : 'idle');
      setValidationMessage(message);
      return;
    }

    setValidationState('typing');
    setValidationMessage('');

    const timer = setTimeout(() => {
      checkAvailability(value);
    }, 500);

    setCheckTimer(timer);
  }, [checkTimer, validateFormat, checkAvailability]);

  // Create identity and reserve handle
  const handleSubmit = async () => {
    if (validationState !== 'available' || !handle) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      const result = await invoke<CommandResult<CreateIdentityResult>>('create_identity_with_handle', {
        handle: handle.trim().toLowerCase()
      });

      if (result.success && result.data) {
        console.log('Identity created:', result.data);
        onComplete();
      } else {
        setCreateError(result.error || 'Failed to create identity');
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Create identity failed:', err);
    } finally {
      setIsCreating(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (checkTimer) clearTimeout(checkTimer);
    };
  }, [checkTimer]);

  // Get status color
  const getStatusColor = () => {
    switch (validationState) {
      case 'available': return 'text-green-400';
      case 'taken': return 'text-red-400';
      case 'invalid': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'checking': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  // Get input border color
  const getInputBorderColor = () => {
    switch (validationState) {
      case 'available': return 'border-green-500 focus:border-green-500';
      case 'taken': return 'border-red-500 focus:border-red-500';
      case 'invalid': return 'border-yellow-500 focus:border-yellow-500';
      case 'error': return 'border-red-500 focus:border-red-500';
      default: return 'border-slate-600 focus:border-blue-500';
    }
  };

  // Intro screen
  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {/* Logo */}
          <div className="w-24 h-24 mb-8 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-5xl">🌐</span>
          </div>

          <h1 className="text-3xl font-bold mb-2 text-center text-white">Gcrumbs</h1>
          <p className="text-slate-400 text-center mb-12">
            Your decentralized identity
          </p>

          {/* Features */}
          <div className="w-full max-w-sm space-y-4 mb-12">
            <Feature
              icon={<KeyRound className="w-5 h-5" />}
              title="Own Your Identity"
              description="One cryptographic key for everything"
            />
            <Feature
              icon={<MapPin className="w-5 h-5" />}
              title="Prove Your Humanity"
              description="No biometrics, just your trajectory"
            />
            <Feature
              icon={<MessageCircle className="w-5 h-5" />}
              title="Encrypted Messaging"
              description="End-to-end encrypted by default"
            />
            <Feature
              icon={<Shield className="w-5 h-5" />}
              title="No Passwords"
              description="Your device is your authenticator"
            />
          </div>
        </div>

        {/* Get Started Button */}
        <div className="p-6">
          <button
            onClick={() => setStep('handle')}
            className="btn btn-primary w-full py-4 flex items-center justify-center gap-2"
          >
            Get Started
            <span>→</span>
          </button>
        </div>
      </div>
    );
  }

  // Handle selection screen
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Back button */}
      <div className="p-4">
        <button
          onClick={() => setStep('intro')}
          className="text-slate-400 flex items-center gap-2"
        >
          ← Back
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center p-6">
        <h1 className="text-2xl font-bold mb-2 text-white">Choose your handle</h1>
        <p className="text-slate-400 text-sm mb-8">
          This will be your unique identity on the network. Choose wisely - it's permanent once claimed!
        </p>

        {/* Handle Input */}
        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-medium">
            @
          </span>
          <input
            type="text"
            value={handle}
            onChange={handleInputChange}
            placeholder="yourhandle"
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className={`w-full pl-9 pr-12 py-4 bg-slate-800 border-2 rounded-xl text-white text-lg placeholder-slate-600 transition-colors ${getInputBorderColor()} focus:outline-none`}
          />

          {/* Status Icon */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {validationState === 'checking' && (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            {validationState === 'available' && (
              <span className="text-green-500 text-xl">✓</span>
            )}
            {validationState === 'taken' && (
              <span className="text-red-500 text-xl">✗</span>
            )}
            {validationState === 'invalid' && (
              <span className="text-yellow-500 text-xl">!</span>
            )}
          </div>
        </div>

        {/* Validation Message */}
        {validationMessage && (
          <p className={`text-sm mb-4 ${getStatusColor()}`}>
            {validationMessage}
          </p>
        )}

        {/* Error Message */}
        {createError && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{createError}</p>
          </div>
        )}

        {/* Requirements */}
        <div className="mb-6 p-4 bg-slate-800/50 rounded-xl">
          <p className="text-slate-500 text-xs mb-2 font-medium uppercase tracking-wide">Requirements</p>
          <ul className="space-y-1 text-sm text-slate-500">
            <li className={handle.length >= 3 ? 'text-green-400' : ''}>
              {handle.length >= 3 ? '✓' : '○'} 3-20 characters
            </li>
            <li className={handle.length > 0 && /^[a-z0-9_]+$/.test(handle) ? 'text-green-400' : ''}>
              {handle.length > 0 && /^[a-z0-9_]+$/.test(handle) ? '✓' : '○'} Letters, numbers, underscore only
            </li>
            <li className={validationState === 'available' ? 'text-green-400' : ''}>
              {validationState === 'available' ? '✓' : '○'} Available on network
            </li>
          </ul>
        </div>
      </div>

      {/* Submit Button */}
      <div className="p-6">
        <button
          onClick={handleSubmit}
          disabled={validationState !== 'available' || isCreating}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${validationState === 'available' && !isCreating
              ? 'btn btn-primary'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
        >
          {isCreating ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating identity...
            </span>
          ) : (
            `Reserve @${handle || 'handle'}`
          )}
        </button>

        <p className="mt-4 text-center text-slate-500 text-xs">
          After reserving, collect 100 breadcrumbs to claim permanently
        </p>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-blue-400 flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-medium text-white">{title}</h3>
        <p className="text-slate-400 text-sm">{description}</p>
      </div>
    </div>
  );
}
