/**
 * Tauri IPC Hooks - Type-safe wrappers for Rust commands
 * 
 * This library provides React hooks for all Tauri commands,
 * with proper TypeScript types and error handling.
 * 
 * WEB FALLBACK: When running in a regular browser (not Tauri),
 * functions fall back to localStorage or sensible defaults.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useEffect, useState, useCallback } from 'react';

// ==================== Platform Detection ====================

export function isTauriApp(): boolean {
  // Check for the specific Tauri IPC internal object for v2, or just global presence
  return typeof window !== 'undefined' &&
    (!!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__);
}



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
  subject?: string;
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
  const fallback = () => localStorage.getItem('gns_public_key');

  if (!isTauriApp()) {
    return fallback();
  }
  try {
    return await invoke<string | null>('get_public_key');
  } catch (e) {
    console.warn('Tauri invoke failed, using fallback:', e);
    return fallback();
  }
}

export async function getEncryptionKey(): Promise<string | null> {
  const fallback = () => localStorage.getItem('gns_encryption_key');

  if (!isTauriApp()) {
    return fallback();
  }
  try {
    return await invoke<string | null>('get_encryption_key');
  } catch (e) {
    console.warn('Tauri invoke failed, using fallback:', e);
    return fallback();
  }
}

export async function getIdentity(): Promise<{ handle?: string; publicKey?: string } | null> {
  try {
    if (!isTauriApp()) {
      const handle = localStorage.getItem('gns_handle');
      const publicKey = localStorage.getItem('gns_public_key');
      return { handle: handle || undefined, publicKey: publicKey || undefined };
    }
    const publicKey = await getPublicKey();
    const handle = await getCurrentHandle();
    return { handle: handle || undefined, publicKey: publicKey || undefined };
  } catch (e) {
    console.error('getIdentity error:', e);
    return null;
  }
}

export async function getCurrentHandle(): Promise<string | null> {
  const fallback = () => localStorage.getItem('gns_handle');

  if (!isTauriApp()) {
    return fallback();
  }
  try {
    return await invoke<string | null>('get_current_handle');
  } catch (e) {
    console.warn('Tauri invoke failed, using fallback:', e);
    return fallback();
  }
}

export async function hasIdentity(): Promise<boolean> {
  const fallback = () => !!localStorage.getItem('gns_public_key');

  if (!isTauriApp()) {
    return fallback();
  }
  try {
    return await invoke<boolean>('has_identity');
  } catch (e) {
    console.warn('Tauri invoke failed, using fallback:', e);
    return fallback();
  }
}

export async function generateIdentity(): Promise<IdentityInfo> {
  if (!isTauriApp()) {
    throw new Error('Cannot generate identity in web browser. Use mobile app.');
  }
  return invoke<IdentityInfo>('generate_identity');
}

export async function importIdentity(privateKeyHex: string): Promise<IdentityInfo> {
  if (!isTauriApp()) {
    throw new Error('Cannot import identity in web browser. Use mobile app.');
  }
  return invoke<IdentityInfo>('import_identity', { privateKeyHex });
}

export async function exportIdentityBackup(): Promise<IdentityBackup> {
  if (!isTauriApp()) {
    throw new Error('Cannot export identity from web browser. Use mobile app.');
  }
  return invoke<IdentityBackup>('export_identity_backup');
}

export async function deleteIdentity(): Promise<void> {
  if (!isTauriApp()) {
    // Web: clear localStorage
    localStorage.removeItem('gns_handle');
    localStorage.removeItem('gns_public_key');
    localStorage.removeItem('gns_session_token');
    localStorage.removeItem('gns_encryption_key');
    return;
  }
  return invoke('delete_identity');
}

export async function signString(message: string): Promise<string | null> {
  if (!isTauriApp()) {
    throw new Error('Cannot sign in web browser. Use mobile app to approve.');
  }
  return invoke<string | null>('sign_string', { message });
}

// ==================== Handle Commands ====================

export async function resolveHandle(handle: string): Promise<HandleInfo | null> {
  // This can work in web via API call
  if (!isTauriApp()) {
    try {
      const response = await fetch(`https://gns-browser-production.up.railway.app/handles/${handle}`);
      const data = await response.json();
      if (data.success && data.data) {
        return data.data;
      }
      return null;
    } catch {
      return null;
    }
  }
  return invoke<HandleInfo | null>('resolve_handle', { handle });
}

export async function checkHandleAvailable(handle: string): Promise<HandleAvailability> {
  if (!isTauriApp()) {
    try {
      const response = await fetch(`https://gns-browser-production.up.railway.app/handles/${handle}/available`);
      const data = await response.json();
      return data.data || { handle, available: false, reason: 'Unknown' };
    } catch {
      return { handle, available: false, reason: 'Network error' };
    }
  }
  return invoke<HandleAvailability>('check_handle_available', { handle });
}

export async function claimHandle(handle: string): Promise<ClaimResult> {
  if (!isTauriApp()) {
    throw new Error('Cannot claim handle from web browser. Use mobile app.');
  }
  return invoke<ClaimResult>('claim_handle', { handle });
}

export async function publishIdentity(): Promise<CommandResult<boolean>> {
  if (!isTauriApp()) {
    throw new Error('Cannot publish identity from web browser. Use mobile app.');
  }
  return invoke<CommandResult<boolean>>('publish_identity');
}

// ==================== Messaging Commands ====================

export async function requestMessageDecryption(
  messageIds: string[],
  conversationWith: string
): Promise<void> {
  if (!isTauriApp()) {
    return;
  }
  return invoke('request_message_decryption', {
    messageIds,
    conversationWith,
  });
}

export async function sendMessage(params: {
  recipientHandle?: string;
  recipientPublicKey?: string;
  payloadType: string;
  payload: unknown;
  threadId?: string;
  replyToId?: string;
}): Promise<SendResult> {
  if (!isTauriApp()) {
    // Web messaging via API (if implemented)
    throw new Error('Web messaging not yet implemented');
  }
  return invoke<SendResult>('send_message', params);
}

export async function addReaction(params: {
  messageId: string;
  emoji: string;
  recipientPublicKey: string;
  recipientHandle?: string;
}): Promise<void> {
  if (!isTauriApp()) {
    throw new Error('Reactions not available in web browser');
  }
  return invoke('add_reaction', params);
}

export async function saveSentEmailMessage(params: {
  recipientEmail: string;
  subject: string;
  snippet: string;
  body: string;
  gatewayPublicKey: string;
  threadId?: string;
  message_id?: string;
}): Promise<{ message_id: string; thread_id: string }> {
  if (!isTauriApp()) {
    throw new Error('Email not available in web browser');
  }
  return invoke<{ message_id: string; thread_id: string }>('save_sent_email_message', {
    recipient_email: params.recipientEmail,
    subject: params.subject,
    snippet: params.snippet,
    body: params.body,
    gateway_public_key: params.gatewayPublicKey,
    thread_id: params.threadId,
    message_id: params.message_id,
  });
}

export async function getThreads(params?: {
  includeArchived?: boolean;
  limit?: number;
}): Promise<ThreadPreview[]> {
  if (!isTauriApp()) {
    // Web: return empty array (no local message storage)
    return [];
  }
  return invoke<ThreadPreview[]>('get_threads', params ?? {});
}

export async function getThread(threadId: string): Promise<ThreadPreview | null> {
  if (!isTauriApp()) {
    return null;
  }
  return invoke<ThreadPreview | null>('get_thread', { threadId });
}

export async function getMessages(params: {
  threadId: string;
  limit?: number;
  beforeId?: string;
}): Promise<Message[]> {
  if (!isTauriApp()) {
    return [];
  }
  return invoke<Message[]>('get_messages', params);
}

export async function markThreadRead(threadId: string): Promise<void> {
  if (!isTauriApp()) {
    return;
  }
  return invoke('mark_thread_read', { threadId });
}

export async function deleteThread(threadId: string): Promise<void> {
  if (!isTauriApp()) {
    return;
  }
  return invoke('delete_thread', { threadId });
}

export async function deleteMessage(messageId: string): Promise<void> {
  if (!isTauriApp()) {
    return;
  }
  return invoke('delete_message', { messageId });
}

// ==================== Breadcrumb Commands ====================

export async function getBreadcrumbCount(): Promise<number> {
  if (!isTauriApp()) {
    return 0; // Web can't collect breadcrumbs
  }
  return invoke<number>('get_breadcrumb_count');
}

export async function listBreadcrumbs(limit = 50, offset = 0): Promise<Breadcrumb[]> {
  if (!isTauriApp()) {
    return []; // Web has no breadcrumbs
  }
  return invoke<Breadcrumb[]>('list_breadcrumbs', { limit, offset });
}

export async function restoreBreadcrumbs(): Promise<number> {
  if (!isTauriApp()) {
    return 0;
  }
  return invoke<number>('restore_breadcrumbs');
}

export async function getBreadcrumbStatus(): Promise<BreadcrumbStatus> {
  const fallback = (): BreadcrumbStatus => {
    const handle = localStorage.getItem('gns_handle');
    return {
      count: 0,
      target: 100,
      progress_percent: 0,
      unique_locations: 0,
      collection_strategy: 'disabled',
      collection_enabled: false,
      handle_claimed: !!handle,
    };
  };

  if (!isTauriApp()) {
    return fallback();
  }
  try {
    return await invoke<BreadcrumbStatus>('get_breadcrumb_status');
  } catch (e) {
    console.warn('Tauri invoke failed, using fallback:', e);
    return fallback();
  }
}

export async function setCollectionEnabled(enabled: boolean): Promise<void> {
  if (!isTauriApp()) {
    console.warn('Breadcrumb collection not available in web browser');
    return;
  }
  return invoke('set_collection_enabled', { enabled });
}

// ==================== Network Commands ====================

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const fallback = (): ConnectionStatus => ({
    relay_connected: true,
    relay_url: 'https://gns-browser-production.up.railway.app',
    last_message_at: Date.now(),
    reconnect_attempts: 0,
  });

  if (!isTauriApp()) {
    return fallback();
  }
  try {
    return await invoke<ConnectionStatus>('get_connection_status');
  } catch (e) {
    console.warn('Tauri invoke failed, using fallback:', e);
    return fallback();
  }
}

export async function reconnect(): Promise<void> {
  if (!isTauriApp()) {
    return; // No-op in web
  }
  return invoke('reconnect');
}

// ==================== Utility Commands ====================

export async function getAppVersion(): Promise<AppVersion> {
  if (!isTauriApp()) {
    return {
      version: '1.0.0-web',
      build_date: new Date().toISOString(),
      git_hash: 'web',
      platform: 'web',
      arch: 'browser',
    };
  }
  return invoke<AppVersion>('get_app_version');
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!isTauriApp()) {
    window.open(url, '_blank');
    return;
  }
  return invoke('open_external_url', { url });
}

export async function getOfflineStatus(): Promise<OfflineStatus> {
  if (!isTauriApp()) {
    return {
      is_online: navigator.onLine,
      breadcrumb_count: 0,
      pending_messages: 0,
    };
  }
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
  if (!isTauriApp()) {
    return localStorage.getItem('gns_stellar_address') || '';
  }
  return invoke<string>('get_stellar_address');
}

export async function getStellarBalances(): Promise<StellarBalances> {
  if (!isTauriApp()) {
    // Web fallback - empty balances
    return {
      stellar_address: '',
      account_exists: false,
      xlm_balance: 0,
      gns_balance: 0,
      has_trustline: false,
      claimable_gns: [],
      use_testnet: false,
    };
  }
  return invoke<StellarBalances>('get_stellar_balances');
}

export async function claimGnsTokens(): Promise<TransactionResponse> {
  if (!isTauriApp()) {
    return { success: false, hash: null, error: 'Not available in web browser', message: null };
  }
  return invoke<TransactionResponse>('claim_gns_tokens');
}

export async function createGnsTrustline(): Promise<TransactionResponse> {
  if (!isTauriApp()) {
    return { success: false, hash: null, error: 'Not available in web browser', message: null };
  }
  return invoke<TransactionResponse>('create_gns_trustline');
}

export async function sendGns(request: SendGnsRequest): Promise<TransactionResponse> {
  if (!isTauriApp()) {
    return { success: false, hash: null, error: 'Not available in web browser', message: null };
  }
  return invoke<TransactionResponse>('send_gns', { request });
}

export async function fundTestnetAccount(): Promise<TransactionResponse> {
  if (!isTauriApp()) {
    return { success: false, hash: null, error: 'Not available in web browser', message: null };
  }
  return invoke<TransactionResponse>('fund_testnet_account');
}

export async function getPaymentHistory(limit?: number): Promise<PaymentHistoryItem[]> {
  if (!isTauriApp()) {
    return [];
  }
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
    // Refresh every 30 seconds (only in Tauri app)
    if (isTauriApp()) {
      const interval = setInterval(refresh, 30000);
      return () => clearInterval(interval);
    }
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

    // Only poll in Tauri app
    if (isTauriApp()) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
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
    if (!isTauriApp()) {
      return; // No Tauri events in web
    }

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

  // Listen for new messages to refresh (only in Tauri)
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