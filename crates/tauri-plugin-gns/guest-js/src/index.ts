/**
 * @file GNS Protocol Tauri Plugin
 * @description Self-sovereign identity through Proof-of-Trajectory
 * @module @anthropic/tauri-plugin-gns-api
 * 
 * @example
 * ```typescript
 * import { gns, createIdentity, sendMessage } from '@anthropic/tauri-plugin-gns-api';
 * 
 * // Create an identity
 * const identity = await createIdentity({ name: 'Alice' });
 * 
 * // Claim a @handle (requires sufficient breadcrumbs)
 * await gns.resolver.claimHandle('alice');
 * 
 * // Send an encrypted message
 * await sendMessage({
 *   to: '@bob',
 *   payload: { type: 'text', content: 'Hello!' },
 * });
 * ```
 * 
 * @packageDocumentation
 */

// Re-export all types
export * from './types';

// Re-export all functions from modules
export * from './identity';
export * from './messaging';
export * from './resolver';
export * from './trust';
export * from './trajectory';

// Import for unified client
import * as identity from './identity';
import * as messaging from './messaging';
import * as resolver from './resolver';
import * as trust from './trust';
import * as trajectory from './trajectory';

/**
 * Unified GNS Protocol client.
 * 
 * Provides organized access to all GNS functionality through namespaced properties.
 * 
 * @example
 * ```typescript
 * import { gns } from '@anthropic/tauri-plugin-gns-api';
 * 
 * // Identity management
 * const id = await gns.identity.create({ name: 'Alice' });
 * 
 * // Messaging
 * await gns.messaging.send({ to: '@bob', payload: { type: 'text', content: 'Hi!' } });
 * 
 * // Handle resolution
 * const resolved = await gns.resolver.resolve('bob');
 * 
 * // Trust scoring
 * const score = await gns.trust.getScore();
 * 
 * // Trajectory collection
 * await gns.trajectory.startCollection();
 * ```
 */
export const gns = {
  /**
   * Identity management functions.
   */
  identity: {
    /** Create a new GNS identity */
    create: identity.createIdentity,
    /** Load an existing identity */
    load: identity.loadIdentity,
    /** Get an identity by public key */
    get: identity.getIdentity,
    /** List all local identities */
    list: identity.listIdentities,
    /** Delete an identity */
    delete: identity.deleteIdentity,
    /** Export identity for backup */
    export: identity.exportIdentity,
    /** Import identity from backup */
    import: identity.importIdentity,
    /** Get active identity's public key */
    getPublicKey: identity.getPublicKey,
    /** Sign a message */
    sign: identity.signMessage,
    /** Verify a signature */
    verify: identity.verifySignature,
    /** Set default identity */
    setDefault: identity.setDefaultIdentity,
  },

  /**
   * End-to-end encrypted messaging functions.
   */
  messaging: {
    /** Send an encrypted message */
    send: messaging.sendMessage,
    /** Send a text message */
    sendText: messaging.sendTextMessage,
    /** Get messages */
    getMessages: messaging.getMessages,
    /** Get a single message */
    getMessage: messaging.getMessage,
    /** Decrypt a message */
    decrypt: messaging.decryptMessage,
    /** Mark message as read */
    markRead: messaging.markAsRead,
    /** Delete a message */
    delete: messaging.deleteMessage,
    /** Get all conversations */
    getConversations: messaging.getConversations,
    /** Send typing indicator */
    sendTyping: messaging.sendTypingIndicator,
    /** Send read receipt */
    sendReadReceipt: messaging.sendReadReceipt,
    /** Send file message */
    sendFile: messaging.sendFileMessage,
    /** Send image message */
    sendImage: messaging.sendImageMessage,
    /** Send location message */
    sendLocation: messaging.sendLocationMessage,
  },

  /**
   * Handle resolution and GNS record functions.
   */
  resolver: {
    /** Resolve @handle to public key */
    resolve: resolver.resolveHandle,
    /** Resolve public key to GNS record */
    resolveIdentity: resolver.resolveIdentity,
    /** Check if handle is available */
    isAvailable: resolver.isHandleAvailable,
    /** Claim a @handle */
    claim: resolver.claimHandle,
    /** Release a @handle */
    release: resolver.releaseHandle,
    /** Get GNS record */
    getRecord: resolver.getRecord,
    /** Update GNS record */
    updateRecord: resolver.updateRecord,
    /** Resolve recipient (@handle or public key) */
    resolveRecipient: resolver.resolveRecipient,
    /** Validate handle format */
    validateHandle: resolver.validateHandle,
    /** Format public key for display */
    formatPublicKey: resolver.formatPublicKey,
  },

  /**
   * Trust scoring and verification functions.
   */
  trust: {
    /** Get trust score */
    getScore: trust.getTrustScore,
    /** Get detailed trust breakdown */
    getDetails: trust.getTrustDetails,
    /** Verify identity meets requirements */
    verify: trust.verifyIdentity,
    /** Check if can claim handle */
    canClaimHandle: trust.canClaimHandle,
    /** Check if can send payments */
    canSendPayments: trust.canSendPayments,
    /** Get tier from score */
    getTier: trust.getTierFromScore,
    /** Get tier display info */
    getTierEmoji: trust.getTierEmoji,
    getTierColor: trust.getTierColor,
    getTierMinScore: trust.getTierMinScore,
    /** Format trust score for display */
    format: trust.formatTrustScore,
    /** Describe trust components */
    describe: trust.describeTrustComponents,
    /** Estimate days to reach tier */
    estimateDaysToTier: trust.estimateDaysToTier,
    /** Preset requirements */
    requirements: {
      forHandleClaim: trust.getHandleClaimRequirements,
      forPayment: trust.getPaymentRequirements,
      none: trust.getNoRequirements,
    },
  },

  /**
   * Proof-of-Trajectory breadcrumb collection functions.
   */
  trajectory: {
    /** Start breadcrumb collection */
    start: trajectory.startCollection,
    /** Stop breadcrumb collection */
    stop: trajectory.stopCollection,
    /** Get collection status */
    getStatus: trajectory.getCollectionStatus,
    /** Get breadcrumbs */
    getBreadcrumbs: trajectory.getBreadcrumbs,
    /** Get breadcrumb count */
    getCount: trajectory.getBreadcrumbCount,
    /** Publish epoch */
    publishEpoch: trajectory.publishEpoch,
    /** Get epochs */
    getEpochs: trajectory.getEpochs,
    /** Add manual breadcrumb */
    addBreadcrumb: trajectory.addBreadcrumb,
    /** Verify chain integrity */
    verifyChain: trajectory.verifyChain,
    /** Get trajectory statistics */
    getStats: trajectory.getTrajectoryStats,
    /** Export trajectory data */
    export: trajectory.exportTrajectory,
    /** Import trajectory data */
    import: trajectory.importTrajectory,
    /** Check if can publish epoch */
    canPublishEpoch: trajectory.canPublishEpoch,
    /** Format helpers */
    formatH3Index: trajectory.formatH3Index,
    formatBreadcrumb: trajectory.formatBreadcrumb,
    /** H3 cell info */
    getCellArea: trajectory.getH3CellArea,
    getRecommendedResolution: trajectory.getRecommendedResolution,
  },
} as const;

/**
 * Default export - the unified GNS client.
 */
export default gns;

// Version info
export const VERSION = '0.1.0';
export const PROTOCOL_VERSION = 1;

/**
 * GNS Protocol Constants
 */
export const GNS_CONSTANTS = {
  /** Ed25519 public key size in bytes */
  PUBLIC_KEY_SIZE: 32,
  /** Ed25519 secret key size in bytes */
  SECRET_KEY_SIZE: 32,
  /** Ed25519 signature size in bytes */
  SIGNATURE_SIZE: 64,
  /** X25519 key size in bytes */
  X25519_KEY_SIZE: 32,
  /** ChaCha20-Poly1305 nonce size in bytes */
  NONCE_SIZE: 12,
  /** Minimum handle length */
  MIN_HANDLE_LENGTH: 3,
  /** Maximum handle length */
  MAX_HANDLE_LENGTH: 20,
  /** Minimum breadcrumbs for handle claim */
  MIN_BREADCRUMBS_FOR_HANDLE: 100,
  /** Minimum trust score for handle claim */
  MIN_TRUST_FOR_HANDLE: 20,
  /** Default H3 resolution */
  DEFAULT_H3_RESOLUTION: 7,
} as const;

/**
 * Trust tier progression.
 */
export const TRUST_TIERS = [
  { tier: 'Seedling', min: 0, max: 19, emoji: '🌱', color: '#9ca3af' },
  { tier: 'Rooted', min: 20, max: 39, emoji: '🌿', color: '#22c55e' },
  { tier: 'Established', min: 40, max: 59, emoji: '🌲', color: '#3b82f6' },
  { tier: 'Trusted', min: 60, max: 79, emoji: '🏔️', color: '#a855f7' },
  { tier: 'Verified', min: 80, max: 100, emoji: '⭐', color: '#f59e0b' },
] as const;

/**
 * Reserved handles that cannot be claimed.
 */
export const RESERVED_HANDLES = [
  'admin', 'root', 'system', 'gns', 'gcrumbs', 'support',
  'help', 'info', 'contact', 'null', 'undefined', 'localhost',
  'api', 'www', 'mail', 'smtp', 'ftp', 'ssh',
] as const;
