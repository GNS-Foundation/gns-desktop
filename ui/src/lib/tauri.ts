/**
 * Tauri IPC Hooks - Type-safe wrappers for Rust commands
 * 
 * This library provides React hooks for all Tauri commands,
 * with proper TypeScript types and error handling.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useEffect, useState, useCallback } from 'react';

// ==================== Types ====================

export interface IdentityInfo {
  public_key: string;
  encryption_key: string;
}

export interface IdentityBackup {
  version: number;
  private_key: string;
  public_key: string;
  encryption_key: string;
  breadcrumb_count: number;
  created_at: number;
}

export interface HandleInfo {
  handle: string;
  public_key: string;
  encryption_key: string;
  avatar_url?: string;
  display_name?: string;
  is_verified: boolean;
}

export interface HandleAvailability {
  handle: string;
  available: boolean;
  reason?: string;
}

export interface ClaimResult {
  success: boolean;
  handle: string;
  transaction_id?: string;
}

export interface BreadcrumbStatus {
  count: number;
  target?: number;
  progress_percent: number;
  unique_locations: number;
  first_breadcrumb_at?: number;
  last_breadcrumb_at?: number;
  collection_strategy: string;
  collection_enabled: boolean;
  handle_claimed: boolean;
  estimated_completion_at?: number;
}

export interface ThreadPreview {
  id: string;
  participant_public_key: string;
  participant_handle?: string;
  last_message_preview?: string;
  last_message_at: number;
  unread_count: number;
  is_pinned: boolean;
  is_muted: boolean;
}

export interface Reaction {
  emoji: string;
  from_public_key: string;
}

export interface Message {
  id: string;
  thread_id: string;
  from_public_key: string;
  from_handle?: string;
  payload_type: string;
  payload: unknown;
  timestamp: number;
  is_outgoing: boolean;
  status: string;
  reply_to_id?: string;
  is_starred?: boolean;
  forwarded_from_id?: string;
  reply_to?: Message;
  reactions: Reaction[];
}

export interface SendResult {
  message_id: string;
  thread_id?: string;
}

export interface ConnectionStatus {
  relay_connected: boolean;
  relay_url: string;
  last_message_at?: number;
  reconnect_attempts: number;
}

export interface AppVersion {
  version: string;
  build_date: string;
  git_hash: string;
  platform: string;
  arch: string;
}

export interface OfflineStatus {
  is_online: boolean;
  breadcrumb_count: number;
  pending_messages: number;
  last_sync?: string;
}

export interface Breadcrumb {
  h3_index: string;
  timestamp: number;
  public_key: string;
  signature: string;
  resolution: number;
  prev_hash?: string;
}

export interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ==================== Identity Commands ====================

export async function getPublicKey(): Promise<string | null> {
  return invoke<string | null>('get_public_key');
}

export async function getEncryptionKey(): Promise<string | null> {
  return invoke<string | null>('get_encryption_key');
}

export async function getCurrentHandle(): Promise<string | null> {
  return invoke<string | null>('get_current_handle');
}

export async function hasIdentity(): Promise<boolean> {
  return invoke<boolean>('has_identity');
}

export async function generateIdentity(): Promise<IdentityInfo> {
  return invoke<IdentityInfo>('generate_identity');
}

export async function importIdentity(privateKeyHex: string): Promise<IdentityInfo> {
  return invoke<IdentityInfo>('import_identity', { privateKeyHex });
}

export async function exportIdentityBackup(): Promise<IdentityBackup> {
  return invoke<IdentityBackup>('export_identity_backup');
}

export async function deleteIdentity(): Promise<void> {
  return invoke('delete_identity');
}

// ==================== Handle Commands ====================

export async function resolveHandle(handle: string): Promise<HandleInfo | null> {
  return invoke<HandleInfo | null>('resolve_handle', { handle });
}

export async function checkHandleAvailable(handle: string): Promise<HandleAvailability> {
  return invoke<HandleAvailability>('check_handle_available', { handle });
}

export async function claimHandle(handle: string): Promise<ClaimResult> {
  return invoke<ClaimResult>('claim_handle', { handle });
}

export async function publishIdentity(): Promise<CommandResult<boolean>> {
  return invoke<CommandResult<boolean>>('publish_identity');
}

// ==================== Messaging Commands ====================

export async function sendMessage(params: {
  recipientHandle?: string;
  recipientPublicKey?: string;
  payloadType: string;
  payload: unknown;
  threadId?: string;
  replyToId?: string;
}): Promise<SendResult> {
  return invoke<SendResult>('send_message', params);
}

export async function addReaction(params: {
  messageId: string;
  emoji: string;
  recipientPublicKey: string;
  recipientHandle?: string;
}): Promise<void> {
  return invoke('add_reaction', params);
}

export async function getThreads(params?: {
  includeArchived?: boolean;
  limit?: number;
}): Promise<ThreadPreview[]> {
  return invoke<ThreadPreview[]>('get_threads', params ?? {});
}

export async function getThread(threadId: string): Promise<ThreadPreview | null> {
  return invoke<ThreadPreview | null>('get_thread', { threadId });
}

export async function getMessages(params: {
  threadId: string;
  limit?: number;
  beforeId?: string;
}): Promise<Message[]> {
  return invoke<Message[]>('get_messages', params);
}

export async function markThreadRead(threadId: string): Promise<void> {
  return invoke('mark_thread_read', { threadId });
}

export async function deleteThread(threadId: string): Promise<void> {
  return invoke('delete_thread', { threadId });
}

export async function deleteMessage(messageId: string): Promise<void> {
  return invoke('delete_message', { messageId });
}

// ==================== Breadcrumb Commands ====================

export async function getBreadcrumbCount(): Promise<number> {
  return invoke<number>('get_breadcrumb_count');
}

export async function listBreadcrumbs(limit = 50, offset = 0): Promise<Breadcrumb[]> {
  return invoke<Breadcrumb[]>('list_breadcrumbs', { limit, offset });
}

export async function restoreBreadcrumbs(): Promise<number> {
  return invoke<number>('restore_breadcrumbs');
}

export async function getBreadcrumbStatus(): Promise<BreadcrumbStatus> {
  return invoke<BreadcrumbStatus>('get_breadcrumb_status');
}

export async function setCollectionEnabled(enabled: boolean): Promise<void> {
  return invoke('set_collection_enabled', { enabled });
}

// ==================== Network Commands ====================

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  return invoke<ConnectionStatus>('get_connection_status');
}

export async function reconnect(): Promise<void> {
  return invoke('reconnect');
}

// ==================== Utility Commands ====================

export async function getAppVersion(): Promise<AppVersion> {
  return invoke<AppVersion>('get_app_version');
}

export async function openExternalUrl(url: string): Promise<void> {
  return invoke('open_external_url', { url });
}

export async function getOfflineStatus(): Promise<OfflineStatus> {
  return invoke<OfflineStatus>('get_offline_status');
}

// ==================== Stellar/GNS Token Types ====================

export interface ClaimableBalance {
  balance_id: string;
  amount: string;
  asset_code: string;
  sponsor: string | null;
}

export interface StellarBalances {
  stellar_address: string;
  account_exists: boolean;
  xlm_balance: number;
  gns_balance: number;
  has_trustline: boolean;
  claimable_gns: ClaimableBalance[];
  use_testnet: boolean;
}

export interface TransactionResponse {
  success: boolean;
  hash: string | null;
  error: string | null;
  message: string | null;
}

export interface SendGnsRequest {
  recipient_handle?: string;
  recipient_public_key?: string;
  amount: number;
  memo?: string;
}

export interface PaymentHistoryItem {
  id: string;
  tx_hash: string;
  created_at: string;
  direction: string;
  amount: string;
  asset_code: string;
  from_address: string;
  to_address: string;
  memo: string | null;
}

// ==================== Stellar Commands ====================

export async function getStellarAddress(): Promise<string> {
  return invoke<string>('get_stellar_address');
}

export async function getStellarBalances(): Promise<StellarBalances> {
  return invoke<StellarBalances>('get_stellar_balances');
}

export async function claimGnsTokens(): Promise<TransactionResponse> {
  return invoke<TransactionResponse>('claim_gns_tokens');
}

export async function createGnsTrustline(): Promise<TransactionResponse> {
  return invoke<TransactionResponse>('create_gns_trustline');
}

export async function sendGns(request: SendGnsRequest): Promise<TransactionResponse> {
  return invoke<TransactionResponse>('send_gns', { request });
}

export async function fundTestnetAccount(): Promise<TransactionResponse> {
  return invoke<TransactionResponse>('fund_testnet_account');
}

export async function getPaymentHistory(limit?: number): Promise<PaymentHistoryItem[]> {
  return invoke<PaymentHistoryItem[]>('get_payment_history', { limit });
}

// ==================== React Hooks ====================

/**
 * Hook for identity state
 */
export function useIdentity() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [pk, h] = await Promise.all([
        getPublicKey(),
        getCurrentHandle(),
      ]);

      setPublicKey(pk);
      setHandle(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { publicKey, handle, loading, error, refresh };
}

/**
 * Hook for breadcrumb status
 */
export function useBreadcrumbStatus() {
  const [status, setStatus] = useState<BreadcrumbStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const s = await getBreadcrumbStatus();
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Refresh every 30 seconds
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { status, loading, error, refresh };
}

/**
 * Hook for connection status
 */
export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const s = await getConnectionStatus();
        setStatus(s);
      } catch (e) {
        console.error('Failed to get connection status:', e);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return status;
}

/**
 * Hook for listening to Tauri events
 */
export function useTauriEvent<T>(
  eventName: string,
  handler: (payload: T) => void
) {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setup = async () => {
      unlisten = await listen<T>(eventName, (event) => {
        handler(event.payload);
      });
    };

    setup();

    return () => {
      unlisten?.();
    };
  }, [eventName, handler]);
}

/**
 * Hook for threads list
 */
export function useThreads() {
  const [threads, setThreads] = useState<ThreadPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const t = await getThreads();
      if (Array.isArray(t)) {
        setThreads(t);
      } else {
        console.error('getThreads returned non-array:', t);
        setThreads([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for new messages to refresh
  useTauriEvent('new_message', () => {
    refresh();
  });

  return { threads, loading, error, refresh };
}

/**
 * Hook for Stellar balances
 */
export function useStellarBalances() {
  const [balances, setBalances] = useState<StellarBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const b = await getStellarBalances();
      setBalances(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balances, loading, error, refresh };
}

/**
 * Hook for payment history
 */
export function usePaymentHistory(limit: number = 20) {
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const h = await getPaymentHistory(limit);
      setHistory(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { history, loading, error, refresh };
}
