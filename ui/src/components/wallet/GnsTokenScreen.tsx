// GNS Token Screen
// View balances, claim tokens, manage Stellar wallet

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  Gift,
  Wallet,
  AlertCircle,
  ExternalLink,
  Download,
  History,
  Send
} from 'lucide-react';


interface ClaimableBalance {
  balance_id: string;
  amount: string;
  asset_code: string;
  sponsor: string | null;
}

interface StellarBalances {
  stellar_address: string;
  account_exists: boolean;
  xlm_balance: number;
  gns_balance: number;
  has_trustline: boolean;
  claimable_gns: ClaimableBalance[];
  use_testnet: boolean;
}

interface TransactionResponse {
  success: boolean;
  hash: string | null;
  error: string | null;
  message: string | null;
}

interface GnsTokenScreenProps {
  onBack: () => void;
}

export function GnsTokenScreen({ onBack }: GnsTokenScreenProps) {
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [funding, setFunding] = useState(false);
  const [balances, setBalances] = useState<StellarBalances | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastClaimResult, setLastClaimResult] = useState<TransactionResponse | null>(null);
  const [creatingTrustline, setCreatingTrustline] = useState(false);

  const loadBalances = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await invoke<StellarBalances>('get_stellar_balances');
      setBalances(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  const handleCopyAddress = async () => {
    if (!balances?.stellar_address) return;

    try {
      await navigator.clipboard.writeText(balances.stellar_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  const handleClaimTokens = async () => {
    setClaiming(true);
    setLastClaimResult(null);

    try {
      const result = await invoke<TransactionResponse>('claim_gns_tokens');
      setLastClaimResult(result);

      if (result.success) {
        // Refresh balances
        await loadBalances();
      }
    } catch (e) {
      setLastClaimResult({
        success: false,
        hash: null,
        error: e instanceof Error ? e.message : String(e),
        message: null,
      });
    } finally {
      setClaiming(false);
    }
  };

  const handleFundAccount = async () => {
    if (!balances?.use_testnet) return;

    setFunding(true);

    try {
      const result = await invoke<TransactionResponse>('fund_testnet_account');

      if (result.success) {
        await loadBalances();
      } else {
        setError(result.error || 'Failed to fund account');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFunding(false);
    }
  };

  const handleCreateTrustline = async () => {
    setCreatingTrustline(true);
    setError(null);

    try {
      const result = await invoke<TransactionResponse>('create_gns_trustline');

      if (result.success) {
        await loadBalances();
      } else {
        setError(result.error || 'Failed to create trustline');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingTrustline(false);
    }
  };

  const totalClaimable = balances?.claimable_gns.reduce(
    (sum, cb) => sum + parseFloat(cb.amount || '0'),
    0
  ) || 0;

  const openExplorer = () => {
    if (!balances?.stellar_address) return;
    const network = balances.use_testnet ? 'testnet' : 'public';
    const url = `https://stellar.expert/explorer/${network}/account/${balances.stellar_address}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-2" />
          <p className="text-slate-400">Loading wallet...</p>
        </div>
      </div>
    );
  }

  if (error && !balances) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <header className="flex items-center gap-3 p-4 border-b border-slate-700">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <h1 className="text-lg font-semibold text-white">GNS Tokens</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={loadBalances}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <h1 className="text-lg font-semibold text-white">GNS Tokens</h1>
        </div>
        <button
          onClick={loadBalances}
          disabled={loading}
          className="p-2 hover:bg-slate-800 rounded-lg"
        >
          <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Error Alert */}
        {error && balances && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Stellar Address Card */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-400" />
              <span className="font-medium text-white">Your Stellar Wallet</span>
            </div>
            <span className={`px-2 py-1 text-xs rounded-full ${balances?.account_exists
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/20 text-amber-400'
              }`}>
              {balances?.account_exists ? 'Active' : 'Not Funded'}
            </span>
          </div>

          <p className="text-xs text-slate-400 mb-2">
            Same key as your GNS identity!
          </p>

          <button
            onClick={handleCopyAddress}
            className="w-full flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <span className="text-sm font-mono text-slate-300 truncate">
              {balances?.stellar_address}
            </span>
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 ml-2" />
            ) : (
              <Copy className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
            )}
          </button>

          <button
            onClick={openExplorer}
            className="flex items-center gap-1 text-xs text-blue-400 mt-2 hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            View on Stellar Explorer
          </button>
        </div>

        {/* Balance Card */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h2 className="font-medium text-white mb-4">Balances</h2>

          {/* GNS Balance */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-xl">G</span>
            </div>
            <div className="flex-1">
              <div className="font-medium text-white">GNS</div>
              <div className="text-xs text-slate-400">
                {balances?.has_trustline ? (
                  'GNS Token'
                ) : (
                  <button
                    onClick={handleCreateTrustline}
                    disabled={creatingTrustline || !balances?.account_exists}
                    className="text-amber-400 hover:text-amber-300 underline disabled:opacity-50"
                  >
                    {creatingTrustline ? 'Creating...' : 'No trustline - Tap to create'}
                  </button>
                )}
              </div>
            </div>
            <div className="text-2xl font-bold text-white">
              {(balances?.gns_balance || 0).toFixed(2)}
            </div>
          </div>

          <div className="border-t border-slate-700 my-4" />

          {/* XLM Balance */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center">
              <span className="text-white font-bold text-xs">XLM</span>
            </div>
            <div className="flex-1">
              <div className="font-medium text-white">XLM</div>
              <div className="text-xs text-slate-400">Stellar Lumens</div>
            </div>
            <div className="text-2xl font-bold text-white">
              {(balances?.xlm_balance || 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Claimable Balances */}
        {balances && balances.claimable_gns.length > 0 && (
          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <span className="font-medium text-white">Claimable GNS</span>
              </div>
              <span className="px-3 py-1 bg-amber-500 text-black text-sm font-bold rounded-full">
                {totalClaimable.toFixed(0)} GNS
              </span>
            </div>

            <p className="text-sm text-slate-300 mb-2">
              {balances.claimable_gns.length} pending claim(s)
            </p>

            {!balances.has_trustline && (
              <p className="text-xs text-slate-400 mb-3">
                Trustline will be created automatically
              </p>
            )}

            <button
              onClick={handleClaimTokens}
              disabled={claiming}
              className="w-full py-3 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {claiming ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Claim Tokens
                </>
              )}
            </button>

            {lastClaimResult && (
              <div className={`mt-3 p-2 rounded-lg text-sm ${lastClaimResult.success
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-red-500/20 text-red-400'
                }`}>
                {lastClaimResult.success
                  ? lastClaimResult.message || 'Tokens claimed!'
                  : lastClaimResult.error || 'Claim failed'
                }
              </div>
            )}
          </div>
        )}

        {/* Actions Card */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h2 className="font-medium text-white mb-4">Actions</h2>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => window.location.href = '/wallet/send'}
              disabled={!balances?.account_exists}
              className="py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
            <button
              onClick={() => window.location.href = '/wallet/history'}
              className="py-3 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 flex items-center justify-center gap-2"
            >
              <History className="w-4 h-4" />
              History
            </button>
          </div>

          {!balances?.account_exists ? (
            <>
              {balances?.use_testnet ? (
                <>
                  <button
                    onClick={handleFundAccount}
                    disabled={funding}
                    className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {funding ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Funding...
                      </>
                    ) : (
                      <>
                        <Wallet className="w-4 h-4" />
                        Fund Account (Testnet)
                      </>
                    )}
                  </button>
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    Get 10,000 XLM to activate your Stellar wallet
                  </p>
                </>
              ) : (
                <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <span className="font-medium text-amber-400">
                      Account needs XLM to activate
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">
                    Claim a @handle to receive 2 XLM + 200 GNS airdrop
                  </p>
                </div>
              )}
            </>
          ) : (
            <button
              onClick={handleCopyAddress}
              className="w-full py-3 border border-slate-600 text-white font-medium rounded-lg hover:bg-slate-700 flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Stellar Address
                </>
              )}
            </button>
          )}
        </div>

        {/* Network Info */}
        <div className="flex items-center justify-center gap-2 p-3 bg-slate-800/50 rounded-lg">
          <div className={`w-2 h-2 rounded-full ${balances?.use_testnet ? 'bg-amber-400' : 'bg-emerald-400'
            }`} />
          <span className="text-sm text-slate-400">
            {balances?.use_testnet ? 'Stellar Testnet' : 'Stellar Mainnet'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default GnsTokenScreen;
