/**
 * @file GNS Protocol TypeScript Types
 * @description Type definitions for the GNS Protocol Tauri plugin
 * @module @anthropic/tauri-plugin-gns-api
 */

// ============================================================================
// Identity Types
// ============================================================================

/**
 * A GNS identity representing a user's cryptographic keypair.
 * The public key serves as the permanent, self-sovereign identifier.
 */
export interface Identity {
  /** Ed25519 public key in hex format (64 characters) */
  publicKey: string;
  /** Human-readable name for the identity */
  name: string;
  /** Claimed @handle (null if not claimed) */
  handle: string | null;
  /** X25519 public key for encryption (derived from Ed25519) */
  encryptionKey: string;
  /** ISO timestamp of identity creation */
  createdAt: string;
  /** Whether this is the default identity */
  isDefault: boolean;
  /** Current trust score (0-100) */
  trustScore: number;
  /** Total breadcrumbs collected */
  breadcrumbCount: number;
}

/** Brief identity summary for listing */
export interface IdentitySummary {
  publicKey: string;
  name: string;
  handle: string | null;
  isDefault: boolean;
  createdAt: string;
  trustScore: number;
}

/** Parameters for creating a new identity */
export interface CreateIdentityParams {
  /** Display name for the identity */
  name: string;
  /** Optional passphrase for key encryption */
  passphrase?: string;
  /** Optional BIP39 seed phrase for deterministic generation */
  seedPhrase?: string;
  /** Set as default identity after creation */
  setAsDefault?: boolean;
}

/** Exported identity for backup/transfer */
export interface ExportedIdentity {
  /** Export format version */
  version: number;
  /** Encrypted secret key data */
  encryptedKey: string;
  /** Encryption salt */
  salt: string;
}

/** Parameters for importing an identity */
export interface ImportIdentityParams {
  /** Serialized export data */
  exportData: string;
  /** Passphrase used during export */
  passphrase?: string;
  /** New name for the imported identity */
  newName?: string;
}

/** Result of a signing operation */
export interface SignatureResult {
  /** Ed25519 signature in hex format (128 characters) */
  signature: string;
  /** Public key that signed */
  publicKey: string;
  /** Original message in hex */
  message: string;
}

/** Result of signature verification */
export interface VerifyResult {
  /** Whether the signature is valid */
  valid: boolean;
  /** Public key used for verification */
  publicKey: string;
}

// ============================================================================
// Messaging Types
// ============================================================================

/** Message type identifiers */
export type MessageType =
  | 'text'
  | 'image'
  | 'file'
  | 'payment'
  | 'location'
  | 'system'
  | 'readReceipt'
  | 'typing'
  | 'custom';

/** Decrypted message content */
export interface DecryptedPayload {
  /** Type of message */
  type: MessageType;
  /** Message content (text, URL, or JSON) */
  content: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** ID of message being replied to */
  replyTo?: string;
}

/** A message in the GNS messaging system */
export interface Message {
  /** Unique message identifier (UUID) */
  id: string;
  /** Sender's public key */
  fromPk: string;
  /** Recipient's public key */
  toPk: string;
  /** Encrypted payload (base64) */
  payload: string;
  /** Ed25519 signature of the payload */
  signature: string;
  /** ISO timestamp when sent */
  createdAt: string;
  /** ISO timestamp when received locally */
  receivedAt: string | null;
  /** Whether the message has been read */
  isRead: boolean;
  /** Cached decrypted content (null if not decrypted) */
  decryptedCache: DecryptedPayload | null;
}

/** Parameters for sending a message */
export interface SendMessageParams {
  /** Recipient (@handle or public key) */
  to: string;
  /** Message payload to send */
  payload: DecryptedPayload;
}

/** A conversation with another user */
export interface Conversation {
  /** Peer's public key */
  peerPk: string;
  /** Peer's @handle (if known) */
  peerHandle: string | null;
  /** Most recent message */
  lastMessage: Message | null;
  /** Count of unread messages */
  unreadCount: number;
  /** ISO timestamp of last activity */
  updatedAt: string;
}

/** Query parameters for fetching messages */
export interface MessageQuery {
  /** Filter by peer public key */
  peerPk?: string;
  /** Maximum messages to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Only return unread messages */
  unreadOnly?: boolean;
  /** Messages after this timestamp */
  after?: string;
  /** Messages before this timestamp */
  before?: string;
}

// ============================================================================
// GNS Record Types
// ============================================================================

/** A published GNS identity record */
export interface GnsRecord {
  /** Record format version */
  version: number;
  /** Ed25519 public key (identity root) */
  identity: string;
  /** Claimed @handle */
  handle: string | null;
  /** X25519 encryption public key */
  encryptionKey: string;
  /** Enabled modules/facets */
  modules: GnsModule[];
  /** Communication endpoints */
  endpoints: GnsEndpoint[];
  /** Published epoch Merkle roots */
  epochRoots: string[];
  /** Current trust score */
  trustScore: number;
  /** Total breadcrumb count */
  breadcrumbCount: number;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/** A module/facet attached to a GNS record */
export interface GnsModule {
  /** Module identifier */
  id: string;
  /** Module schema (e.g., "profile@1.0", "dix@1.0") */
  schema: string;
  /** Human-readable name */
  name: string;
  /** Module description */
  description: string | null;
  /** URL to module data */
  dataUrl: string | null;
  /** Whether module data is public */
  isPublic: boolean;
  /** Module-specific configuration */
  config: Record<string, unknown>;
}

/** Communication endpoint types */
export type EndpointType = 'direct' | 'relay' | 'onion';

/** Communication protocols */
export type EndpointProtocol = 'quic' | 'wss' | 'https';

/** A communication endpoint */
export interface GnsEndpoint {
  /** Endpoint type */
  type: EndpointType;
  /** Communication protocol */
  protocol: EndpointProtocol;
  /** Host address or onion URL */
  address: string;
  /** Port number */
  port: number;
  /** Priority (lower = preferred) */
  priority: number;
  /** Whether currently reachable */
  isActive: boolean;
}

/** Result of resolving a @handle */
export interface ResolvedHandle {
  /** The @handle */
  handle: string;
  /** Associated public key */
  publicKey: string;
  /** X25519 encryption key */
  encryptionKey: string;
  /** Trust score */
  trustScore: number;
  /** Breadcrumb count */
  breadcrumbCount: number;
  /** Whether result came from cache */
  fromCache: boolean;
  /** ISO timestamp of resolution */
  resolvedAt: string;
}

// ============================================================================
// Trust Types
// ============================================================================

/** Trust score tiers */
export type TrustTier =
  | 'Seedling'    // 0-19%
  | 'Rooted'      // 20-39%
  | 'Established' // 40-59%
  | 'Trusted'     // 60-79%
  | 'Verified';   // 80-100%

/** Components contributing to trust score */
export interface TrustComponents {
  /** Pattern consistency (0-100) */
  trajectoryQuality: number;
  /** Regular collection (0-100) */
  temporalConsistency: number;
  /** Valid hash chains (0-100) */
  chainIntegrity: number;
  /** Published epochs (0-100) */
  epochReliability: number;
  /** Unique locations (0-100) */
  geographicDiversity: number;
}

/** Complete trust score with breakdown */
export interface TrustScore {
  /** Overall score (0-100) */
  score: number;
  /** Current tier */
  tier: TrustTier;
  /** Score components */
  components: TrustComponents;
  /** ISO timestamp of calculation */
  calculatedAt: string;
  /** Total breadcrumbs */
  breadcrumbCount: number;
  /** Account age in days */
  accountAgeDays: number;
  /** Unique H3 cells visited */
  uniqueLocations: number;
  /** Published epoch count */
  epochCount: number;
}

/** A single verification check */
export interface TrustCheck {
  /** Check name */
  name: string;
  /** Whether check passed */
  passed: boolean;
  /** Human-readable details */
  details: string;
  /** Required value (if applicable) */
  required?: number;
  /** Actual value */
  actual?: number;
}

/** Result of identity verification */
export interface TrustVerification {
  /** Public key verified */
  identity: string;
  /** Whether all checks passed */
  isVerified: boolean;
  /** Current trust score */
  trustScore: TrustScore;
  /** Individual check results */
  checks: TrustCheck[];
  /** ISO timestamp of verification */
  verifiedAt: string;
}

/** Requirements for trust verification */
export interface TrustRequirements {
  /** Minimum trust score (0-100) */
  minTrustScore?: number;
  /** Minimum breadcrumb count */
  minBreadcrumbs?: number;
  /** Minimum account age in days */
  minAccountAgeDays?: number;
  /** Minimum unique locations */
  minUniqueLocations?: number;
  /** Required trust tier */
  requiredTier?: TrustTier;
}

// ============================================================================
// Breadcrumb/Trajectory Types
// ============================================================================

/** Location data source */
export type BreadcrumbSource =
  | 'gps'
  | 'wifi'
  | 'cell'
  | 'network'
  | 'manual'
  | 'fused';

/** A location breadcrumb (privacy-preserving) */
export interface Breadcrumb {
  /** Unique breadcrumb ID */
  id: string;
  /** H3 hexagonal cell index */
  h3Index: string;
  /** H3 resolution level (0-15) */
  h3Resolution: number;
  /** ISO timestamp */
  timestamp: string;
  /** Hash of previous breadcrumb */
  prevHash: string;
  /** This breadcrumb's hash */
  hash: string;
  /** Ed25519 signature */
  signature: string;
  /** Location data source */
  source: BreadcrumbSource;
  /** Location accuracy in meters */
  accuracy?: number;
  /** Whether published to network */
  published: boolean;
}

/** A block of breadcrumbs */
export interface BreadcrumbBlock {
  /** Block index within epoch */
  index: number;
  /** Breadcrumbs in this block */
  breadcrumbs: Breadcrumb[];
  /** Merkle root of breadcrumb hashes */
  merkleRoot: string;
  /** Hash of previous block */
  prevBlockHash: string | null;
  /** This block's hash */
  blockHash: string;
  /** ISO timestamp of creation */
  createdAt: string;
}

/** An epoch (published breadcrumb bundle) */
export interface EpochHeader {
  /** Identity public key */
  identity: string;
  /** Epoch sequence number */
  epochIndex: number;
  /** ISO timestamp of first breadcrumb */
  startTime: string;
  /** ISO timestamp of last breadcrumb */
  endTime: string;
  /** Merkle root of all blocks */
  merkleRoot: string;
  /** Number of blocks in epoch */
  blockCount: number;
  /** Hash of previous epoch */
  prevEpochHash?: string;
  /** Signature of epoch hash */
  signature: string;
  /** This epoch's hash */
  epochHash: string;
}

/** Current breadcrumb collection status */
export interface CollectionStatus {
  /** Whether collection is active */
  isActive: boolean;
  /** Total breadcrumbs collected */
  totalCount: number;
  /** Unpublished breadcrumb count */
  pendingCount: number;
  /** Published epoch count */
  epochCount: number;
  /** ISO timestamp of last collection */
  lastCollectionAt?: string;
  /** ISO timestamp of last epoch */
  lastEpochAt?: string;
  /** Current H3 resolution */
  h3Resolution: number;
  /** Collection interval in seconds */
  collectionInterval: number;
}

/** Query parameters for breadcrumbs */
export interface BreadcrumbQuery {
  /** Only return unpublished breadcrumbs */
  unpublishedOnly?: boolean;
  /** Maximum to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** After this timestamp */
  after?: string;
  /** Before this timestamp */
  before?: string;
}

// ============================================================================
// Plugin Configuration
// ============================================================================

/** Plugin configuration options */
export interface GnsConfig {
  /** GNS relay server URLs */
  relayUrls: string[];
  /** Enable storage encryption */
  encryptStorage: boolean;
  /** Message fetch limit */
  messageLimit: number;
  /** Cache TTL in seconds */
  cacheTtlSeconds: number;
  /** Minimum trust score for handle claim */
  minTrustScoreForHandle: number;
  /** Minimum breadcrumbs for handle claim */
  minBreadcrumbsForHandle: number;
  /** Minimum breadcrumbs per epoch */
  minBreadcrumbsForEpoch: number;
  /** H3 resolution for breadcrumbs (0-15) */
  h3Resolution: number;
  /** Breadcrumb collection interval in seconds */
  breadcrumbCollectionInterval: number;
}

// ============================================================================
// Error Types
// ============================================================================

/** GNS error codes */
export type GnsErrorCode =
  | 'GNS_CRYPTO'
  | 'GNS_STORAGE'
  | 'GNS_NETWORK'
  | 'GNS_IDENTITY_NOT_FOUND'
  | 'GNS_HANDLE_NOT_FOUND'
  | 'GNS_HANDLE_UNAVAILABLE'
  | 'GNS_INVALID_HANDLE'
  | 'GNS_DECRYPTION_FAILED'
  | 'GNS_INVALID_SIGNATURE'
  | 'GNS_INSUFFICIENT_TRUST'
  | 'GNS_INSUFFICIENT_BREADCRUMBS'
  | 'GNS_CONFIG'
  | 'GNS_SERIALIZATION'
  | 'GNS_PERMISSION_DENIED'
  | 'GNS_INVALID_INPUT'
  | 'GNS_TIMEOUT'
  | 'GNS_INTERNAL';

/** Structured error from plugin */
export interface GnsError {
  /** Error code */
  code: GnsErrorCode;
  /** Human-readable message */
  message: string;
  /** Whether error is recoverable */
  recoverable: boolean;
}
