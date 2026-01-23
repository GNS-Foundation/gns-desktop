/**
 * @file GNS Identity Management
 * @description Functions for creating, managing, and using GNS identities
 * @module @anthropic/tauri-plugin-gns-api/identity
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  Identity,
  IdentitySummary,
  CreateIdentityParams,
  ExportedIdentity,
  ImportIdentityParams,
  SignatureResult,
  VerifyResult,
} from './types';

/**
 * Create a new GNS identity with Ed25519 keypair.
 * 
 * @example
 * ```typescript
 * const identity = await createIdentity({
 *   name: 'My Identity',
 *   setAsDefault: true,
 * });
 * console.log(`Created identity: ${identity.publicKey}`);
 * ```
 * 
 * @param params - Identity creation parameters
 * @returns The newly created identity
 */
export async function createIdentity(params: CreateIdentityParams): Promise<Identity> {
  return invoke<Identity>('plugin:gns|create_identity', { params });
}

/**
 * Load an existing identity and set it as the active identity.
 * 
 * @example
 * ```typescript
 * const identity = await loadIdentity('abc123...');
 * ```
 * 
 * @param publicKey - The identity's public key (hex)
 * @returns The loaded identity
 */
export async function loadIdentity(publicKey: string): Promise<Identity> {
  return invoke<Identity>('plugin:gns|load_identity', { publicKey });
}

/**
 * Get an identity by public key, or the active identity if not specified.
 * 
 * @example
 * ```typescript
 * // Get active identity
 * const active = await getIdentity();
 * 
 * // Get specific identity
 * const specific = await getIdentity('abc123...');
 * ```
 * 
 * @param publicKey - Optional public key to look up
 * @returns The identity, or null if not found
 */
export async function getIdentity(publicKey?: string): Promise<Identity | null> {
  return invoke<Identity | null>('plugin:gns|get_identity', { publicKey: publicKey ?? null });
}

/**
 * List all identities stored locally.
 * 
 * @example
 * ```typescript
 * const identities = await listIdentities();
 * identities.forEach(id => {
 *   console.log(`${id.name}: ${id.handle ?? id.publicKey}`);
 * });
 * ```
 * 
 * @returns Array of identity summaries
 */
export async function listIdentities(): Promise<IdentitySummary[]> {
  return invoke<IdentitySummary[]>('plugin:gns|list_identities');
}

/**
 * Delete an identity and all associated data.
 * 
 * WARNING: This action is irreversible. Export the identity first if needed.
 * 
 * @example
 * ```typescript
 * await deleteIdentity('abc123...');
 * ```
 * 
 * @param publicKey - The identity's public key
 */
export async function deleteIdentity(publicKey: string): Promise<void> {
  return invoke<void>('plugin:gns|delete_identity', { publicKey });
}

/**
 * Export an identity for backup or transfer to another device.
 * 
 * @example
 * ```typescript
 * const exported = await exportIdentity('abc123...', 'my-secure-passphrase');
 * // Store exported.encryptedKey safely
 * ```
 * 
 * @param publicKey - The identity's public key
 * @param passphrase - Optional passphrase for encryption
 * @returns Exported identity data
 */
export async function exportIdentity(
  publicKey: string,
  passphrase?: string
): Promise<ExportedIdentity> {
  return invoke<ExportedIdentity>('plugin:gns|export_identity', {
    publicKey,
    passphrase: passphrase ?? null,
  });
}

/**
 * Import a previously exported identity.
 * 
 * @example
 * ```typescript
 * const identity = await importIdentity({
 *   exportData: exportedJson,
 *   passphrase: 'my-secure-passphrase',
 *   newName: 'Restored Identity',
 * });
 * ```
 * 
 * @param params - Import parameters
 * @returns The imported identity
 */
export async function importIdentity(params: ImportIdentityParams): Promise<Identity> {
  return invoke<Identity>('plugin:gns|import_identity', { params });
}

/**
 * Get the active identity's public key.
 * 
 * @example
 * ```typescript
 * const pk = await getPublicKey();
 * if (pk) {
 *   console.log(`Active identity: ${pk}`);
 * }
 * ```
 * 
 * @returns Public key or null if no active identity
 */
export async function getPublicKey(): Promise<string | null> {
  return invoke<string | null>('plugin:gns|get_public_key');
}

/**
 * Sign a message with the identity's Ed25519 key.
 * 
 * @example
 * ```typescript
 * const result = await signMessage('Hello, GNS!');
 * console.log(`Signature: ${result.signature}`);
 * ```
 * 
 * @param message - Message to sign (string or Uint8Array)
 * @param publicKey - Optional identity to sign with (uses active if not specified)
 * @returns Signature result
 */
export async function signMessage(
  message: string | Uint8Array,
  publicKey?: string
): Promise<SignatureResult> {
  const messageStr = typeof message === 'string' 
    ? message 
    : new TextDecoder().decode(message);
  return invoke<SignatureResult>('plugin:gns|sign_message', {
    message: messageStr,
    publicKey: publicKey ?? null,
  });
}

/**
 * Verify an Ed25519 signature.
 * 
 * @example
 * ```typescript
 * const result = await verifySignature(
 *   'abc123...', // public key
 *   'Hello, GNS!',
 *   'deadbeef...' // signature
 * );
 * if (result.valid) {
 *   console.log('Signature verified!');
 * }
 * ```
 * 
 * @param publicKey - Signer's public key
 * @param message - Original message
 * @param signature - Signature to verify
 * @returns Verification result
 */
export async function verifySignature(
  publicKey: string,
  message: string | Uint8Array,
  signature: string
): Promise<VerifyResult> {
  const messageStr = typeof message === 'string' 
    ? message 
    : new TextDecoder().decode(message);
  return invoke<VerifyResult>('plugin:gns|verify_signature', {
    publicKey,
    message: messageStr,
    signature,
  });
}

/**
 * Set an identity as the default.
 * 
 * @example
 * ```typescript
 * await setDefaultIdentity('abc123...');
 * ```
 * 
 * @param publicKey - The identity's public key
 */
export async function setDefaultIdentity(publicKey: string): Promise<void> {
  return invoke<void>('plugin:gns|set_default_identity', { publicKey });
}
