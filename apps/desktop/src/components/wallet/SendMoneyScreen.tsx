// Send Money Screen
// 3-step payment flow: Enter → Confirm → Result

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ArrowLeft,
  User,
  Check,

  RefreshCw,
  Send,
  ExternalLink,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface ResolvedIdentity {
  public_key: string;
  handle: string | null;
  encryption_key: string;
  display_name: string | null;
  is_verified: boolean;
}

interface TransactionResponse {
  success: boolean;
  hash: string | null;
  error: string | null;
  message: string | null;
}

interface SendMoneyScreenProps {
  onBack: () => void;
  prefillRecipient?: string;
  prefillAmount?: string;
}

type Step = 'enter' | 'confirm' | 'result';

const CURRENCIES = ['GNS', 'XLM'] as const;
const CURRENCY_SYMBOLS: Record<string, string> = {
  GNS: '✦',
  XLM: '⋆',
};

export function SendMoneyScreen({ onBack, prefillRecipient, prefillAmount }: SendMoneyScreenProps) {
  const [step, setStep] = useState<Step>('enter');

  // Form state
  const [recipient, setRecipient] = useState(prefillRecipient || '');
  const [amount, setAmount] = useState(prefillAmount || '');
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>('GNS');
  const [memo, setMemo] = useState('');

  // Resolution state
  const [isSearching, setIsSearching] = useState(false);
  const [resolvedIdentity, setResolvedIdentity] = useState<ResolvedIdentity | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  // Transaction state
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<TransactionResponse | null>(null);

  // Search debounce
  const searchRecipient = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResolvedIdentity(null);
      setRecipientError(null);
      return;
    }

    setIsSearching(true);
    setRecipientError(null);

    try {
      // Clean handle
      const cleanQuery = query.replace('@', '').toLowerCase().trim();

      // Try to resolve handle
      const result = await invoke<ResolvedIdentity | null>('resolve_handle', { handle: cleanQuery });

      if (result) {
        setResolvedIdentity(result);
        setRecipientError(null);
      } else {
        // Check if it looks like a public key
        if (cleanQuery.length === 64 && /^[a-fA-F0-9]+$/.test(cleanQuery)) {
          // Valid hex public key
          setResolvedIdentity({
            public_key: cleanQuery,
            handle: null,
            encryption_key: '',
            display_name: null,
            is_verified: false,
          });
          setRecipientError(null);
        } else {
          setResolvedIdentity(null);
          setRecipientError('Recipient not found');
        }
      }
    } catch (e) {
      // Check if it looks like a public key
      const cleanQuery = query.replace('@', '').trim();
      if (cleanQuery.length === 64 && /^[a-fA-F0-9]+$/.test(cleanQuery)) {
        // Valid hex public key
        setResolvedIdentity({
          public_key: cleanQuery,
          handle: null,
          encryption_key: '',
          display_name: null,
          is_verified: false,
        });
        setRecipientError(null);
      } else {
        setResolvedIdentity(null);
        setRecipientError('Recipient not found');
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (recipient) {
        searchRecipient(recipient);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [recipient, searchRecipient]);

  const canContinue = resolvedIdentity && amount && parseFloat(amount) > 0;

  const handleContinue = () => {
    if (canContinue) {
      setStep('confirm');
    }
  };

  const handleSend = async () => {
    if (!resolvedIdentity) return;

    setIsSending(true);

    try {
      const result = await invoke<TransactionResponse>('send_gns', {
        request: {
          recipient_handle: resolvedIdentity.handle,
          recipient_public_key: resolvedIdentity.public_key,
          amount: parseFloat(amount),
          memo: memo || null,
        }
      });

      setSendResult(result);
      setStep('result');
    } catch (e) {
      setSendResult({
        success: false,
        hash: null,
        error: e instanceof Error ? e.message : String(e),
        message: null,
      });
      setStep('result');
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    setRecipient('');
    setAmount('');
    setMemo('');
    setResolvedIdentity(null);
    setSendResult(null);
    setStep('enter');
  };

  const getStepTitle = () => {
    switch (step) {
      case 'enter': return 'Send Money';
      case 'confirm': return 'Confirm Payment';
      case 'result': return sendResult?.success ? 'Payment Sent' : 'Payment Failed';
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b border-slate-700">
        <button
          onClick={step === 'enter' ? onBack : () => setStep('enter')}
          className="p-2 hover:bg-slate-800 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <h1 className="text-lg font-semibold text-white">{getStepTitle()}</h1>
      </header>

      <div className="flex-1 overflow-auto">
        {step === 'enter' && (
          <EnterStep
            recipient={recipient}
            setRecipient={setRecipient}
            amount={amount}
            setAmount={setAmount}
            currency={currency}
            setCurrency={setCurrency}
            memo={memo}
            setMemo={setMemo}
            isSearching={isSearching}
            resolvedIdentity={resolvedIdentity}
            recipientError={recipientError}
            canContinue={!!canContinue}
            onContinue={handleContinue}
          />
        )}

        {step === 'confirm' && resolvedIdentity && (
          <ConfirmStep
            resolvedIdentity={resolvedIdentity}
            amount={amount}
            currency={currency}
            memo={memo}
            isSending={isSending}
            onSend={handleSend}
            onEdit={() => setStep('enter')}
          />
        )}

        {step === 'result' && (
          <ResultStep
            success={sendResult?.success || false}
            hash={sendResult?.hash ?? null}
            error={sendResult?.error ?? null}
            message={sendResult?.message ?? null}
            amount={amount}
            currency={currency}
            recipientHandle={resolvedIdentity?.handle}
            onDone={onBack}
            onRetry={() => setStep('confirm')}
            onNewPayment={handleReset}
          />
        )}
      </div>
    </div>
  );
}

// ==================== STEP 1: ENTER ====================

interface EnterStepProps {
  recipient: string;
  setRecipient: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  currency: typeof CURRENCIES[number];
  setCurrency: (v: typeof CURRENCIES[number]) => void;
  memo: string;
  setMemo: (v: string) => void;
  isSearching: boolean;
  resolvedIdentity: ResolvedIdentity | null;
  recipientError: string | null;
  canContinue: boolean;
  onContinue: () => void;
}

function EnterStep({
  recipient,
  setRecipient,
  amount,
  setAmount,
  currency,
  setCurrency,
  memo,
  setMemo,
  isSearching,
  resolvedIdentity,
  recipientError,
  canContinue,
  onContinue,
}: EnterStepProps) {
  return (
    <div className="p-5 space-y-6">
      {/* Recipient */}
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Recipient
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            <User className="w-5 h-5 text-slate-500" />
          </div>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="@handle or public key"
            className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {isSearching ? (
              <RefreshCw className="w-5 h-5 text-slate-500 animate-spin" />
            ) : resolvedIdentity ? (
              <Check className="w-5 h-5 text-emerald-400" />
            ) : null}
          </div>
        </div>

        {recipientError && (
          <p className="mt-2 text-sm text-red-400">{recipientError}</p>
        )}

        {resolvedIdentity?.handle && (
          <div className="mt-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400">@{resolvedIdentity.handle}</span>
            {resolvedIdentity.is_verified && (
              <span className="text-xs text-slate-400">(verified)</span>
            )}
          </div>
        )}
      </div>

      {/* Amount */}
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Amount
        </label>
        <div className="flex gap-3">
          {/* Currency selector */}
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as typeof CURRENCIES[number])}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_SYMBOLS[c]} {c}
              </option>
            ))}
          </select>

          {/* Amount input */}
          <div className="flex-1 relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 text-lg">
              {CURRENCY_SYMBOLS[currency]}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                // Only allow numbers and decimal point
                const value = e.target.value.replace(/[^0-9.]/g, '');
                // Only allow one decimal point
                const parts = value.split('.');
                if (parts.length > 2) return;
                // Limit decimal places
                if (parts[1] && parts[1].length > 7) return;
                setAmount(value);
              }}
              placeholder="0.00"
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-2xl font-bold placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Memo */}
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Memo (Optional)
        </label>
        <div className="relative">
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value.slice(0, 140))}
            placeholder="What is this for?"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            maxLength={140}
          />
          <span className="absolute right-3 bottom-1 text-xs text-slate-500">
            {memo.length}/140
          </span>
        </div>
      </div>

      {/* Continue Button */}
      <button
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full py-4 bg-emerald-600 text-white font-bold text-lg rounded-xl hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        CONTINUE
      </button>
    </div>
  );
}

// ==================== STEP 2: CONFIRM ====================

interface ConfirmStepProps {
  resolvedIdentity: ResolvedIdentity;
  amount: string;
  currency: string;
  memo: string;
  isSending: boolean;
  onSend: () => void;
  onEdit: () => void;
}

function ConfirmStep({
  resolvedIdentity,
  amount,
  currency,
  memo,
  isSending,
  onSend,
  onEdit,
}: ConfirmStepProps) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const displayName = resolvedIdentity.handle
    ? `@${resolvedIdentity.handle}`
    : `${resolvedIdentity.public_key.substring(0, 16)}...`;
  const initial = resolvedIdentity.handle?.[0].toUpperCase() || '?';

  return (
    <div className="p-5 flex flex-col items-center">
      {/* Amount Display */}
      <div className="mt-8 mb-6 text-center">
        <div className="text-5xl font-bold text-white">
          {symbol}{amount}
        </div>
        <div className="text-slate-400 mt-1">{currency}</div>
      </div>

      {/* Recipient Card */}
      <div className="w-full bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <span className="text-emerald-400 font-bold text-xl">{initial}</span>
          </div>
          <div className="flex-1">
            <div className="text-xs text-slate-400">To</div>
            <div className="text-lg font-bold text-white">{displayName}</div>
          </div>
        </div>

        {memo && (
          <>
            <div className="border-t border-slate-700 my-4" />
            <div className="flex items-start gap-2 text-slate-400">
              <span className="text-lg">📝</span>
              <span className="italic">{memo}</span>
            </div>
          </>
        )}
      </div>

      {/* Payment Info */}
      <div className="w-full bg-slate-800/50 rounded-xl p-4 mb-8">
        <div className="flex items-center gap-3">
          <Send className="w-5 h-5 text-emerald-400" />
          <div>
            <div className="text-white font-medium">Via Stellar Network</div>
            <div className="text-xs text-slate-400">
              {currency === 'GNS' ? 'GNS Token Transfer' : 'Native XLM Transfer'}
            </div>
          </div>
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={onSend}
        disabled={isSending}
        className="w-full py-4 bg-emerald-600 text-white font-bold text-lg rounded-xl hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isSending ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Sending...
          </>
        ) : (
          'SEND PAYMENT'
        )}
      </button>

      <button
        onClick={onEdit}
        className="mt-3 text-slate-400 hover:text-white transition-colors"
      >
        Edit Details
      </button>
    </div>
  );
}

// ==================== STEP 3: RESULT ====================

interface ResultStepProps {
  success: boolean;
  hash: string | null;
  error: string | null;
  message: string | null;
  amount: string;
  currency: string;
  recipientHandle: string | null | undefined;
  onDone: () => void;
  onRetry: () => void;
  onNewPayment: () => void;
}

function ResultStep({
  success,
  hash,
  error,
  amount,
  currency,
  recipientHandle,
  onDone,
  onRetry,
  onNewPayment,
}: ResultStepProps) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;

  const openExplorer = () => {
    if (!hash) return;
    // Determine network - for now assume mainnet
    const url = `https://stellar.expert/explorer/public/tx/${hash}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-5 flex flex-col items-center justify-center min-h-[400px]">
      {/* Status Icon */}
      <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${success ? 'bg-emerald-500/20' : 'bg-red-500/20'
        }`}>
        {success ? (
          <CheckCircle className="w-16 h-16 text-emerald-400" />
        ) : (
          <XCircle className="w-16 h-16 text-red-400" />
        )}
      </div>

      {/* Status Text */}
      <h2 className="text-2xl font-bold text-white mb-2">
        {success ? 'Payment Sent!' : 'Payment Failed'}
      </h2>

      {success ? (
        <>
          <p className="text-slate-400 text-center mb-2">
            {symbol}{amount} to {recipientHandle ? `@${recipientHandle}` : 'recipient'}
          </p>

          {hash && (
            <div className="text-xs text-slate-500 font-mono mb-4">
              TX: {hash.substring(0, 12)}...
            </div>
          )}

          {hash && (
            <button
              onClick={openExplorer}
              className="flex items-center gap-1 text-blue-400 hover:underline mb-6"
            >
              <ExternalLink className="w-4 h-4" />
              View on Stellar Explorer
            </button>
          )}
        </>
      ) : (
        <p className="text-red-400 text-center mb-6 max-w-sm">
          {error || 'Unknown error'}
        </p>
      )}

      {/* Actions */}
      <div className="w-full space-y-3 mt-4">
        <button
          onClick={success ? onDone : onRetry}
          className={`w-full py-4 font-bold text-lg rounded-xl transition-colors ${success
            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
            : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
        >
          {success ? 'DONE' : 'TRY AGAIN'}
        </button>

        {success && (
          <button
            onClick={onNewPayment}
            className="w-full py-4 border border-slate-600 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors"
          >
            Send Another Payment
          </button>
        )}
      </div>
    </div>
  );
}

export default SendMoneyScreen;
