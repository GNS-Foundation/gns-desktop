/**
 * @file GNS Handle Resolution
 * @description Functions for resolving @handles to public keys and managing GNS records
 * @module @anthropic/tauri-plugin-gns-api/resolver
 */

import { invoke } from '@tauri-apps/api/core';
import type { ResolvedHandle, GnsRecord } from './types';

/**
 * Resolve a @handle to its associated public key and metadata.
 * 
 * Resolution uses local cache when available (TTL configurable).
 * Falls back to network lookup on cache miss.
 * 
 * @example
 * ```typescript
 * const resolved = await resolveHandle('alice');
 * console.log(`@alice = ${resolved.publicKey}`);
 * console.log(`Trust: ${resolved.trustScore}%`);
 * ```
 * 
 * @param handle - The handle to resolve (with or without @)
 * @returns Resolution result with public key and trust info
 */
export async function resolveHandle(handle: string): Promise<ResolvedHandle> {
  // Normalize handle (remove @ if present)
  const normalizedHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  return invoke<ResolvedHandle>('plugin:gns|resolve_handle', { handle: normalizedHandle });
}

/**
 * Resolve a public key to its full GNS record.
 * 
 * The GNS record contains:
 * - Identity information
 * - Enabled modules/facets
 * - Communication endpoints
 * - Published epoch roots
 * - Trust score and breadcrumb count
 * 
 * @example
 * ```typescript
 * const record = await resolveIdentity('abc123...');
 * console.log(`Modules: ${record.modules.map(m => m.schema).join(', ')}`);
 * ```
 * 
 * @param publicKey - The public key to resolve
 * @returns Full GNS record
 */
export async function resolveIdentity(publicKey: string): Promise<GnsRecord> {
  return invoke<GnsRecord>('plugin:gns|resolve_identity', { publicKey });
}

/**
 * Check if a handle is available for claiming.
 * 
 * @example
 * ```typescript
 * if (await isHandleAvailable('myhandle')) {
 *   await claimHandle('myhandle');
 * }
 * ```
 * 
 * @param handle - The handle to check
 * @returns True if available
 */
export async function isHandleAvailable(handle: string): Promise<boolean> {
  const normalizedHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  return invoke<boolean>('plugin:gns|is_handle_available', { handle: normalizedHandle });
}

/**
 * Claim a @handle for the active identity.
 * 
 * Requirements:
 * - Handle must be available (not reserved, not claimed)
 * - Identity must meet minimum trust requirements:
 *   - At least 100 breadcrumbs collected
 *   - Trust score of at least 20%
 *   - Account age of at least 7 days
 *   - At least 10 unique locations visited
 * 
 * @example
 * ```typescript
 * try {
 *   await claimHandle('myhandle');
 *   console.log('Handle claimed successfully!');
 * } catch (e) {
 *   if (e.code === 'GNS_INSUFFICIENT_TRUST') {
 *     console.log('Need more breadcrumbs to claim a handle');
 *   }
 * }
 * ```
 * 
 * @param handle - The handle to claim (3-20 chars, lowercase alphanumeric + underscore)
 */
export async function claimHandle(handle: string): Promise<void> {
  const normalizedHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  return invoke<void>('plugin:gns|claim_handle', { handle: normalizedHandle });
}

/**
 * Release a claimed @handle.
 * 
 * This frees the handle to be claimed by someone else.
 * 
 * @example
 * ```typescript
 * await releaseHandle('myhandle');
 * ```
 * 
 * @param handle - The handle to release
 */
export async function releaseHandle(handle: string): Promise<void> {
  const normalizedHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  return invoke<void>('plugin:gns|release_handle', { handle: normalizedHandle });
}

/**
 * Get the full GNS record for a public key.
 * 
 * @example
 * ```typescript
 * const record = await getRecord('abc123...');
 * console.log(`Endpoints: ${record.endpoints.length}`);
 * ```
 * 
 * @param publicKey - The public key to look up
 * @returns Full GNS record
 */
export async function getRecord(publicKey: string): Promise<GnsRecord> {
  return invoke<GnsRecord>('plugin:gns|get_record', { publicKey });
}

/**
 * Update the active identity's GNS record.
 * 
 * This publishes updates to:
 * - Modules/facets
 * - Communication endpoints
 * - Trust score (from local data)
 * 
 * @example
 * ```typescript
 * const currentRecord = await getRecord(myPublicKey);
 * const updatedRecord = {
 *   ...currentRecord,
 *   modules: [...currentRecord.modules, newModule],
 * };
 * await updateRecord(updatedRecord);
 * ```
 * 
 * @param record - Updated GNS record
 */
export async function updateRecord(record: GnsRecord): Promise<void> {
  return invoke<void>('plugin:gns|update_record', { record });
}

/**
 * Resolve a recipient string to a public key.
 * 
 * Handles both @handles and raw public keys.
 * 
 * @example
 * ```typescript
 * // Returns resolved public key
 * const pk1 = await resolveRecipient('@alice');
 * 
 * // Returns the input (already a public key)
 * const pk2 = await resolveRecipient('abc123...');
 * ```
 * 
 * @param recipient - @handle or public key
 * @returns Public key
 */
export async function resolveRecipient(recipient: string): Promise<string> {
  if (recipient.startsWith('@')) {
    const resolved = await resolveHandle(recipient);
    return resolved.publicKey;
  }
  // Assume it's already a public key
  return recipient;
}

/**
 * Validate a handle format.
 * 
 * Handles must be:
 * - 3-20 characters long
 * - Lowercase letters, numbers, and underscores only
 * - Not a reserved handle
 * 
 * @example
 * ```typescript
 * validateHandle('alice');      // Valid
 * validateHandle('alice_123');  // Valid
 * validateHandle('Alice');      // Invalid (uppercase)
 * validateHandle('a');          // Invalid (too short)
 * validateHandle('admin');      // Invalid (reserved)
 * ```
 * 
 * @param handle - The handle to validate
 * @returns Validation result with error message if invalid
 */
export function validateHandle(handle: string): { valid: boolean; error?: string } {
  const normalizedHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  
  // Reserved handles that cannot be claimed
  const RESERVED = [
    'admin', 'root', 'system', 'gns', 'gcrumbs', 'support',
    'help', 'info', 'contact', 'null', 'undefined', 'localhost',
    'api', 'www', 'mail', 'smtp', 'ftp', 'ssh',
  ];
  
  if (normalizedHandle.length < 3) {
    return { valid: false, error: 'Handle must be at least 3 characters' };
  }
  
  if (normalizedHandle.length > 20) {
    return { valid: false, error: 'Handle must be at most 20 characters' };
  }
  
  if (!/^[a-z0-9_]+$/.test(normalizedHandle)) {
    return { valid: false, error: 'Handle can only contain lowercase letters, numbers, and underscores' };
  }
  
  if (RESERVED.includes(normalizedHandle)) {
    return { valid: false, error: 'This handle is reserved' };
  }
  
  return { valid: true };
}

/**
 * Format a public key for display.
 * 
 * @example
 * ```typescript
 * formatPublicKey('abc123def456...'); // 'abc1...f456'
 * ```
 * 
 * @param publicKey - Full public key
 * @param length - Characters to show at start/end (default 4)
 * @returns Shortened display string
 */
export function formatPublicKey(publicKey: string, length = 4): string {
  if (publicKey.length <= length * 2 + 3) {
    return publicKey;
  }
  return `${publicKey.slice(0, length)}...${publicKey.slice(-length)}`;
}

/**
 * Format a recipient for display, preferring handle over public key.
 * 
 * @example
 * ```typescript
 * formatRecipient(resolved); // '@alice' or 'abc1...f456'
 * ```
 * 
 * @param resolved - Resolved handle info
 * @returns Display string
 */
export function formatRecipient(resolved: ResolvedHandle): string {
  return resolved.handle ? `@${resolved.handle}` : formatPublicKey(resolved.publicKey);
}
