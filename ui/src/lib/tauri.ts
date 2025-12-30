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

export async function getThreads(params?: {
  includeArchived?: boolean;
  limit?: number;
}): Promise<ThreadPreview[]> {
  return invoke<ThreadPreview[]>('get_threads', params ?? {});
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

// ==================== Breadcrumb Commands ====================

export async function getBreadcrumbCount(): Promise<number> {
  return invoke<number>('get_breadcrumb_count');
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
      setThreads(t);
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
