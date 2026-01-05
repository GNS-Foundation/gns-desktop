// ============================================================================
// GNS-TAURI - Stellar React Hooks
// ============================================================================
// React hooks for calling Stellar Tauri commands from the frontend.
//
// Usage:
//   import { useStellar } from './hooks/useStellar';
//   const { balance, loading, error, refetchBalance } = useStellar();
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// TYPES
// ============================================================================

export interface WalletBalance {
  stellar_address: string;
  account_exists: boolean;
  xlm_balance: number;
  gns_balance: number;
  has_trustline: boolean;
  claimable_gns: ClaimableBalance[];
  use_testnet: boolean;
}

export interface ClaimableBalance {
  balance_id: string;
  amount: string;
  asset_code: string;
  sponsor: string | null;
}

export interface TransactionResponse {
  success: boolean;
  hash: string | null;
  error: string | null;
  message: string | null;
}

// ============================================================================
// UTILS
// ============================================================================

export async function getExplorerAccountUrl(_address: string, _testnet: boolean = true): Promise<string> {
  // NOTE: backend is now source of truth for explorer URL, arguments ignored
  // We keep the signature compatible for now, or we could simplify.
  // Actually, WalletCard calls it with args. Let's just use the command.
  return invoke<string>('get_stellar_explorer_url');
}

export async function getExplorerTxUrl(txHash: string, testnet: boolean = true): Promise<string> {
  const network = testnet ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${network}/tx/${txHash}`;
}

// ============================================================================
// BALANCE HOOK
// ============================================================================

export function useStellar() {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // NOTE: get_stellar_balances takes no args and uses the current identity in state
      const result = await invoke<WalletBalance>('get_stellar_balances');
      setBalance(result);
    } catch (e) {
      console.error('Failed to fetch balance:', e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    stellarAddress: balance?.stellar_address,
    xlmBalance: balance?.xlm_balance ?? 0,
    gnsBalance: balance?.gns_balance ?? 0,
    claimableGns: balance?.claimable_gns?.reduce((acc, curr) => acc + parseFloat(curr.amount), 0) ?? 0,
    hasTrustline: balance?.has_trustline ?? false,
    useTestnet: balance?.use_testnet ?? false,
    isFunded: balance?.account_exists ?? false,
    isMainnet: !(balance?.use_testnet ?? false),
    loading,
    error,
    refetchBalance: fetchBalance
  };
}

// ============================================================================
// ACTION HOOKS
// ============================================================================

export function useSendGns() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TransactionResponse | null>(null);

  const send = useCallback(async (
    _senderPublicKey: string, // Unused, uses backend state
    _senderSecret: string,    // Unused, uses backend state
    recipient: string,        // Handle or Public Key
    amount: string,
    memo?: string
  ) => {
    setSending(true);
    setResult(null);
    try {
      let recipient_handle: string | null = null;
      let recipient_public_key: string | null = null;

      if (recipient.startsWith('@')) {
        recipient_handle = recipient.substring(1); // remove @
      } else if (recipient.match(/^[a-z0-9_]+$/) && !recipient.startsWith('G')) {
        recipient_handle = recipient;
      } else {
        recipient_public_key = recipient;
      }

      const res = await invoke<TransactionResponse>('send_gns', {
        request: {
          recipient_handle,
          recipient_public_key,
          amount: parseFloat(amount),
          memo
        }
      });
      setResult(res);
      return res;
    } catch (e: any) {
      const errRes = { success: false, hash: null, error: String(e), message: null };
      setResult(errRes);
      return errRes;
    } finally {
      setSending(false);
    }
  }, []);

  return { send, sending, result };
}

export function useCreateGnsTrustline() {
  const [creating, setCreating] = useState(false);

  const create = useCallback(async (_key: string, _secret: string) => {
    setCreating(true);
    try {
      const res = await invoke<TransactionResponse>('create_gns_trustline');
      return res;
    } catch (e) {
      return { success: false, hash: null, error: String(e), message: null };
    } finally {
      setCreating(false);
    }
  }, []);

  return { create, creating };
}

export function useClaimBalance() {
  const [claiming, setClaiming] = useState(false);

  const claim = useCallback(async () => {
    setClaiming(true);
    try {
      const res = await invoke<TransactionResponse>('claim_gns_tokens');
      return res;
    } catch (e) {
      return { success: false, hash: null, error: String(e), message: null };
    } finally {
      setClaiming(false);
    }
  }, []);

  return { claim, claiming };
}

export function useFriendbotFund() {
  const [funding, setFunding] = useState(false);

  const fund = useCallback(async (_address: string) => {
    setFunding(true);
    try {
      const res = await invoke<TransactionResponse>('fund_testnet_account');
      return res.success;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setFunding(false);
    }
  }, []);

  return { fund, funding };
}

export default useStellar;
