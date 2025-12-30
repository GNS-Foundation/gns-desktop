/**
 * Handle Claim Screen
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Sparkles, Loader2 } from 'lucide-react';
import { checkHandleAvailable, claimHandle, useBreadcrumbStatus } from '../lib/tauri';
import { useDebounce } from '../hooks/useDebounce';
import { useEffect } from 'react';
import clsx from 'clsx';

export function HandleClaimScreen() {
  const navigate = useNavigate();
  const { status: breadcrumbStatus } = useBreadcrumbStatus();
  const [handle, setHandle] = useState('');
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<{
    available: boolean;
    reason?: string;
  } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const debouncedHandle = useDebounce(handle, 500);

  // Check availability when handle changes
  useEffect(() => {
    if (debouncedHandle.length >= 3) {
      checkAvailability(debouncedHandle);
    } else {
      setAvailability(null);
    }
  }, [debouncedHandle]);

  const checkAvailability = async (h: string) => {
    try {
      setChecking(true);
      setError(null);
      const result = await checkHandleAvailable(h);
      setAvailability({
        available: result.available,
        reason: result.reason,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check availability');
    } finally {
      setChecking(false);
    }
  };

  const handleClaim = async () => {
    if (!availability?.available) return;

    try {
      setClaiming(true);
      setError(null);
      await claimHandle(handle);
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to claim handle');
    } finally {
      setClaiming(false);
    }
  };

  const canClaim = breadcrumbStatus && breadcrumbStatus.count >= 100;

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6 animate-pulse-glow">
          <Check className="w-10 h-10 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">@{handle} is yours!</h1>
        <p className="text-slate-400">Redirecting to home...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Claim Your Handle</h1>
      </header>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold mb-2">Choose Your @handle</h2>
          <p className="text-slate-400 text-sm">
            This is your permanent identity on GNS. Choose wisely!
          </p>
        </div>

        {/* Handle Input */}
        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            @
          </span>
          <input
            type="text"
            value={handle}
            onChange={(e) =>
              setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
            }
            placeholder="yourhandle"
            maxLength={20}
            className="input w-full pl-10 pr-12 text-lg"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {checking && (
              <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
            )}
            {!checking && availability?.available && (
              <Check className="w-5 h-5 text-green-400" />
            )}
            {!checking && availability && !availability.available && (
              <X className="w-5 h-5 text-red-400" />
            )}
          </div>
        </div>

        {/* Availability Status */}
        {availability && !availability.available && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">
              {availability.reason || 'This handle is not available'}
            </p>
          </div>
        )}

        {availability?.available && (
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mb-4">
            <p className="text-green-400 text-sm">
              @{handle} is available! 🎉
            </p>
          </div>
        )}

        {/* Requirements */}
        {!canClaim && (
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
            <p className="text-yellow-400 text-sm mb-2">
              You need 100 breadcrumbs to claim a handle.
            </p>
            <p className="text-slate-400 text-sm">
              Current: {breadcrumbStatus?.count || 0} / 100
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Rules */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <h3 className="font-medium mb-2">Handle Rules</h3>
          <ul className="text-slate-400 text-sm space-y-1">
            <li className={clsx(handle.length >= 3 && 'text-green-400')}>
              • 3-20 characters
            </li>
            <li
              className={clsx(
                handle.length > 0 &&
                  /^[a-z0-9_]+$/.test(handle) &&
                  'text-green-400'
              )}
            >
              • Letters, numbers, and underscores only
            </li>
            <li>• Cannot be changed after claiming</li>
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6">
        <button
          onClick={handleClaim}
          disabled={
            !canClaim ||
            !availability?.available ||
            claiming ||
            handle.length < 3
          }
          className={clsx(
            'btn w-full py-4 flex items-center justify-center gap-2',
            canClaim && availability?.available
              ? 'btn-primary'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          )}
        >
          {claiming ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Claiming...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Claim @{handle || 'handle'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
