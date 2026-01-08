// ===========================================
// GNS BROWSER CRYPTO - DUAL ENCRYPTION E2E
// 
// Ed25519 signing: tweetnacl
// ChaCha20-Poly1305 encryption: libsodium
// 
// NEW: Dual encryption - one copy for recipient, one for sender
// ===========================================

import nacl from 'tweetnacl';
import { encode as base64Encode, decode as base64Decode } from 'base64-arraybuffer';
import _sodium from 'libsodium-wrappers';

// Constants (must match Flutter/Node exactly)
const HKDF_INFO = 'gns-envelope-v1';
const NONCE_LENGTH = 12;  // ChaCha20-Poly1305 uses 12-byte nonce

// Libsodium instance
let sodium = null;

/**
 * Initialize libsodium (call before using encryption)
 */
export async function initCrypto() {
  if (!sodium) {
    await _sodium.ready;
    sodium = _sodium;
    console.log('🔐 Crypto initialized (libsodium + tweetnacl)');
  }
  return true;
}

// Auto-initialize on import
initCrypto().catch(console.error);

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex) {
  if (!hex) return new Uint8Array(0);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert Uint8Array to base64
 */
export function bytesToBase64(bytes) {
  return base64Encode(bytes.buffer);
}

/**
 * Convert base64 to Uint8Array
 */
export function base64ToBytes(b64) {
  return new Uint8Array(base64Decode(b64));
}

/**
 * Generate random bytes
 */
export function randomBytes(length) {
  return nacl.randomBytes(length);
}

// ===========================================
// KEY GENERATION (Ed25519 for identity)
// ===========================================

/**
 * Generate Ed25519 keypair for identity/signing
 * Returns: { publicKey: hex, privateKey: hex, seed: hex }
 */
export function generateEd25519Keypair() {
  const keypair = nacl.sign.keyPair();
  return {
    publicKey: bytesToHex(keypair.publicKey),
    privateKey: bytesToHex(keypair.secretKey),
    seed: bytesToHex(keypair.secretKey.slice(0, 32)),
  };
}

/**
 * Generate X25519 keypair for encryption
 * Returns: { publicKey: hex, privateKey: hex }
 */
export function generateX25519Keypair() {
  const keypair = nacl.box.keyPair();
  return {
    publicKey: bytesToHex(keypair.publicKey),
    privateKey: bytesToHex(keypair.secretKey),
  };
}

/**
 * Generate both keypairs (Ed25519 + X25519)
 * This is the DUAL-KEY architecture
 */
export function generateDualKeypair() {
  const ed25519 = generateEd25519Keypair();
  const x25519 = generateX25519Keypair();

  return {
    identityPublicKey: ed25519.publicKey,
    identityPrivateKey: ed25519.privateKey,
    identitySeed: ed25519.seed,
    encryptionPublicKey: x25519.publicKey,
    encryptionPrivateKey: x25519.privateKey,
  };
}

// ===========================================
// HKDF KEY DERIVATION (Web Crypto API)
// ===========================================

/**
 * Derive encryption key from shared secret using HKDF-SHA256
 */
async function hkdfDerive(sharedSecret, info = HKDF_INFO) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(info),
    },
    keyMaterial,
    256
  );

  return new Uint8Array(derivedBits);
}

// ===========================================
// ChaCha20-Poly1305 ENCRYPTION (libsodium)
// ===========================================

/**
 * Encrypt payload for a recipient using X25519 + ChaCha20-Poly1305
 * 
 * @param {string} plaintext - Message text to encrypt
 * @param {string} recipientX25519Hex - Recipient's X25519 public key (hex)
 * @returns {Object} { encryptedPayload, ephemeralPublicKey, nonce } (all base64)
 */
export async function encryptForRecipient(plaintext, recipientX25519Hex) {
  // Ensure sodium is initialized
  if (!sodium) {
    await initCrypto();
  }

  try {
    // 1. Generate ephemeral X25519 keypair
    const ephemeralKeypair = sodium.crypto_box_keypair();

    // 2. Parse recipient's X25519 public key
    const recipientPubKey = hexToBytes(recipientX25519Hex);

    if (recipientPubKey.length !== 32) {
      throw new Error(`Invalid X25519 key length: ${recipientPubKey.length}`);
    }

    // 3. X25519 key exchange (ECDH)
    const sharedSecret = sodium.crypto_scalarmult(
      ephemeralKeypair.privateKey,
      recipientPubKey
    );

    // 4. Derive encryption key using HKDF-SHA256
    const encryptionKey = await hkdfDerive(sharedSecret, HKDF_INFO);

    // 5. Generate random 12-byte nonce
    const nonce = sodium.randombytes_buf(NONCE_LENGTH);

    // 6. Create payload JSON
    const payload = JSON.stringify({
      type: 'text',
      text: plaintext,
      format: 'plain',
    });
    const plaintextBytes = new TextEncoder().encode(payload);

    // 7. Encrypt with ChaCha20-Poly1305 (IETF variant)
    const ciphertext = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
      plaintextBytes,
      null,  // additional data (AAD)
      null,  // nsec (not used)
      nonce,
      encryptionKey
    );

    console.log('🔐 Message encrypted (ChaCha20-Poly1305):');
    console.log('   Plaintext size:', plaintextBytes.length);
    console.log('   Ciphertext size:', ciphertext.length);
    console.log('   Ephemeral pub:', bytesToHex(ephemeralKeypair.publicKey).substring(0, 16) + '...');

    // Use ORIGINAL base64 variant (with padding, +/) for consistency with decryption
    const b64Variant = sodium.base64_variants.ORIGINAL;

    return {
      success: true,
      encryptedPayload: sodium.to_base64(ciphertext, b64Variant),
      ephemeralPublicKey: sodium.to_base64(ephemeralKeypair.publicKey, b64Variant),
      nonce: sodium.to_base64(nonce, b64Variant),
      payloadSize: plaintext.length,
    };
  } catch (error) {
    console.error('❌ Encryption error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Create a complete GNS envelope for sending (single recipient encryption)
 * 
 * @param {string} fromPublicKey - Sender's Ed25519 public key (hex)
 * @param {string} toPublicKey - Recipient's Ed25519 identity key (hex)
 * @param {string} plaintext - Message text
 * @param {string} recipientEncryptionKey - Recipient's X25519 key (hex)
 * @param {string} threadId - Optional thread ID
 */
export async function createEncryptedEnvelope(
  fromPublicKey,
  toPublicKey,
  plaintext,
  recipientEncryptionKey,
  threadId = null
) {
  // Encrypt the payload
  const encrypted = await encryptForRecipient(plaintext, recipientEncryptionKey);

  if (!encrypted.success) {
    throw new Error(`Encryption failed: ${encrypted.error}`);
  }

  // Create envelope structure (matches Flutter client)
  const envelope = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    version: 1,
    fromPublicKey: fromPublicKey.toLowerCase(),
    toPublicKeys: [toPublicKey.toLowerCase()],
    ccPublicKeys: null,
    payloadType: 'gns/text.plain',
    encryptedPayload: encrypted.encryptedPayload,
    payloadSize: encrypted.payloadSize,
    threadId: threadId,
    replyToId: null,
    forwardOfId: null,
    timestamp: Date.now(),
    expiresAt: null,
    ephemeralPublicKey: encrypted.ephemeralPublicKey,
    recipientKeys: null,
    nonce: encrypted.nonce,
    priority: 1,
  };

  console.log('📧 Encrypted envelope created:', envelope.id);

  return envelope;
}

// ===========================================
// NEW: DUAL ENCRYPTION (for sender + recipient)
// ===========================================

/**
 * Create a GNS envelope with DUAL encryption
 * One copy for recipient (they can decrypt)
 * One copy for sender (we can decrypt our own sent messages)
 * 
 * @param {string} fromPublicKey - Sender's Ed25519 public key (hex)
 * @param {string} toPublicKey - Recipient's Ed25519 identity key (hex)
 * @param {string} plaintext - Message text
 * @param {string} recipientEncryptionKey - Recipient's X25519 key (hex)
 * @param {string} senderEncryptionKey - Sender's X25519 public key (hex)
 * @param {string} threadId - Optional thread ID
 */
export async function createDualEncryptedEnvelope(
  fromPublicKey,
  toPublicKey,
  plaintext,
  recipientEncryptionKey,
  senderEncryptionKey,
  threadId = null
) {
  console.log('🔐 Creating DUAL encrypted envelope...');
  console.log('   Recipient X25519:', recipientEncryptionKey?.substring(0, 16) + '...');
  console.log('   Sender X25519:', senderEncryptionKey?.substring(0, 16) + '...');

  // 1. Encrypt for RECIPIENT (so they can read it)
  const recipientEncrypted = await encryptForRecipient(plaintext, recipientEncryptionKey);

  if (!recipientEncrypted.success) {
    throw new Error(`Recipient encryption failed: ${recipientEncrypted.error}`);
  }

  // 2. Encrypt for SENDER (so we can read our own sent messages)
  let senderEncrypted = null;
  if (senderEncryptionKey) {
    senderEncrypted = await encryptForRecipient(plaintext, senderEncryptionKey);

    if (!senderEncrypted.success) {
      console.warn('⚠️ Sender encryption failed, continuing without:', senderEncrypted.error);
      senderEncrypted = null;
    }
  } else {
    console.warn('⚠️ No sender encryption key provided, sender copy disabled');
  }

  // 3. Create envelope structure with BOTH encrypted copies
  const envelope = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    version: 1,
    fromPublicKey: fromPublicKey.toLowerCase(),
    toPublicKeys: [toPublicKey.toLowerCase()],
    ccPublicKeys: null,
    payloadType: 'gns/text.plain',

    // Recipient encryption (existing fields)
    encryptedPayload: recipientEncrypted.encryptedPayload,
    ephemeralPublicKey: recipientEncrypted.ephemeralPublicKey,
    nonce: recipientEncrypted.nonce,

    // Sender encryption (NEW fields)
    senderEncryptedPayload: senderEncrypted?.encryptedPayload || null,
    senderEphemeralPublicKey: senderEncrypted?.ephemeralPublicKey || null,
    senderNonce: senderEncrypted?.nonce || null,

    payloadSize: recipientEncrypted.payloadSize,
    threadId: threadId,
    replyToId: null,
    forwardOfId: null,
    timestamp: Date.now(),
    expiresAt: null,
    recipientKeys: null,
    priority: 1,
  };

  console.log('📧 DUAL encrypted envelope created:', envelope.id);
  console.log('   ✅ Recipient can decrypt');
  console.log('   ✅ Sender can decrypt:', !!senderEncrypted);

  return envelope;
}

// ===========================================
// DECRYPTION (for incoming messages)
// ===========================================

/**
 * Decrypt an incoming message using our X25519 private key
 * 
 * @param {Object} msg - Message object with envelope containing encrypted fields
 * @returns {string|null} Decrypted text or null if failed
 */
export async function tryDecryptMessage(msg) {
  // Ensure sodium is initialized
  if (!sodium) {
    await initCrypto();
  }

  const session = JSON.parse(localStorage.getItem('gns_browser_session') || '{}');

  if (!session.encryptionPrivateKey) {
    console.warn('🔐 No encryption private key - cannot decrypt');
    return null;
  }

  try {
    // ✅ Check if this is an outgoing message (we sent it)
    const isOutgoing = msg.isOutgoing ||
      (msg.from_pk || msg.fromPublicKey || '').toLowerCase() === session.publicKey?.toLowerCase();

    // Get encrypted fields - backend already puts sender_* fields into regular fields for outgoing messages
    let encryptedPayloadBase64, ephemeralPublicKeyBase64, nonceBase64;

    encryptedPayloadBase64 = msg.encryptedPayload || msg.envelope?.encryptedPayload;
    ephemeralPublicKeyBase64 = msg.ephemeralPublicKey || msg.envelope?.ephemeralPublicKey;
    nonceBase64 = msg.nonce || msg.envelope?.nonce;

    if (!encryptedPayloadBase64 || !ephemeralPublicKeyBase64 || !nonceBase64) {
      console.warn('🔐 Missing encryption fields');
      return null;
    }

    // ✅ Try BOTH base64 variants for backwards compatibility
    const variants = [
      sodium.base64_variants.ORIGINAL,           // Standard: +/ with padding
      sodium.base64_variants.URLSAFE,            // URL-safe: -_ with padding  
      sodium.base64_variants.URLSAFE_NO_PADDING, // URL-safe without padding (default)
    ];

    let encrypted, ephemeralPub, nonce;

    for (const variant of variants) {
      try {
        encrypted = sodium.from_base64(encryptedPayloadBase64, variant);
        ephemeralPub = sodium.from_base64(ephemeralPublicKeyBase64, variant);
        nonce = sodium.from_base64(nonceBase64, variant);
        console.log('🔐 Base64 decoded successfully with variant:', variant);
        break;
      } catch (e) {
        continue; // Try next variant
      }
    }

    if (!encrypted || !ephemeralPub || !nonce) {
      console.error('🔐 Failed to decode base64 with any variant');
      return null;
    }

    // Get our X25519 private key
    const myPrivateKey = hexToBytes(session.encryptionPrivateKey);

    // X25519 key exchange
    const sharedSecret = sodium.crypto_scalarmult(myPrivateKey, ephemeralPub);

    // Derive encryption key using HKDF
    const encryptionKey = await hkdfDerive(sharedSecret, HKDF_INFO);

    // Decrypt with ChaCha20-Poly1305
    const decrypted = sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
      null,  // nsec
      encrypted,
      null,  // additional data
      nonce,
      encryptionKey
    );

    // Parse JSON payload
    const payloadStr = new TextDecoder().decode(decrypted);
    const payload = JSON.parse(payloadStr);

    console.log('🔓 Message decrypted successfully');
    console.log('   Type:', payload.type);
    console.log('   Text:', payload.text?.substring(0, 30) + '...');

    return payload.text || payload.content || payloadStr;
  } catch (error) {
    console.error('🔐 Decryption failed:', error.message);
    return null;
  }
}

// ===========================================
// CANONICAL JSON (for signing)
// ===========================================

/**
 * Create canonical JSON string (sorted keys, compact)
 * Must match server exactly for signatures to verify
 */
export function canonicalJson(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((sorted, k) => {
        sorted[k] = value[k];
        return sorted;
      }, {});
    }
    return value;
  });
}

// ===========================================
// Ed25519 SIGNING (tweetnacl - works fine)
// ===========================================

/**
 * Sign data with Ed25519 (NO hashing - matches backend)
 * 
 * @param {string} data - Data to sign (UTF-8 string)
 * @param {string} privateKeyHex - Ed25519 private key (64 bytes, hex)
 * @returns {string} Signature as HEX (128 chars)
 */
export async function sign(data, privateKeyHex) {
  const privateKey = hexToBytes(privateKeyHex);
  const dataBytes = new TextEncoder().encode(data);
  const signature = nacl.sign.detached(dataBytes, privateKey);
  return bytesToHex(signature);
}

/**
 * Sign a GNS envelope
 */
export async function signEnvelope(envelope, privateKeyHex) {
  const canonical = canonicalJson(envelope);
  console.log('🔐 Signing envelope:', envelope.id?.substring(0, 8));
  return sign(canonical, privateKeyHex);
}

/**
 * Sign message payload for HTTP API
 * Backend expects signature of canonicalJson({ to_pk, payload })
 */
export async function signMessage(toPk, payload, privateKeyHex) {
  const dataToSign = canonicalJson({ to_pk: toPk, payload: payload });
  console.log('🔐 Signing message to:', toPk.substring(0, 16) + '...');
  return sign(dataToSign, privateKeyHex);
}

/**
 * Verify Ed25519 signature
 */
export async function verify(data, signatureHex, publicKeyHex) {
  try {
    const signature = hexToBytes(signatureHex);
    const publicKey = hexToBytes(publicKeyHex);
    const dataBytes = new TextEncoder().encode(data);
    return nacl.sign.detached.verify(dataBytes, signature, publicKey);
  } catch (error) {
    console.error('Verification error:', error);
    return false;
  }
}

// ===========================================
// LEGACY: buildEnvelope (for signature-based auth)
// ===========================================

/**
 * Build a complete GNS envelope with encryption and signature
 * Used for legacy signature-based authentication
 */
export async function buildEnvelope({
  content,
  fromIdentityPublicKey,
  fromIdentityPrivateKey,
  toIdentityPublicKey,
  toEncryptionPublicKey,
  threadId = null,
}) {
  // Create encrypted envelope
  const envelope = await createEncryptedEnvelope(
    fromIdentityPublicKey,
    toIdentityPublicKey,
    content,
    toEncryptionPublicKey,
    threadId
  );

  // Sign the envelope
  const signature = await signEnvelope(envelope, fromIdentityPrivateKey);

  return {
    ...envelope,
    signature,
  };
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  // Init
  initCrypto,

  // Key generation
  generateEd25519Keypair,
  generateX25519Keypair,
  generateDualKeypair,

  // Encryption (ChaCha20-Poly1305 via libsodium)
  encryptForRecipient,
  createEncryptedEnvelope,
  createDualEncryptedEnvelope,  // NEW: Dual encryption

  // Decryption
  tryDecryptMessage,

  // Signing (Ed25519 via tweetnacl)
  sign,
  signEnvelope,
  signMessage,
  verify,

  // Envelope builder
  buildEnvelope,
  canonicalJson,

  // Utilities
  hexToBytes,
  bytesToHex,
  bytesToBase64,
  base64ToBytes,
  randomBytes,
};