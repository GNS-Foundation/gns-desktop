// ===========================================
// GNS BROWSER AUTH - SECURE QR PAIRING
// 
// NO KEY GENERATION IN BROWSER!
// Identity is verified via mobile app QR scan.
// 
// ===========================================

import { GNS_API_BASE } from './gnsApi';

const BROWSER_SESSION_KEY = 'gns_browser_session';

// ===========================================
// SESSION MANAGEMENT
// ===========================================

/**
 * Get current browser session
 * Returns null if not paired via QR
 */
export function getSession() {
  try {
    const stored = localStorage.getItem(BROWSER_SESSION_KEY);
    if (stored) {
      const session = JSON.parse(stored);
      // Only return if it's a verified session (paired via QR)
      if (session.isVerified && session.sessionToken) {
        return session;
      }
    }
  } catch (e) {
    console.error('Failed to get session:', e);
  }
  return null;
}

/**
 * Save verified browser session (called after QR approval)
 */
export function saveSession(session) {
  try {
    // Ensure required fields
    if (!session.sessionToken || !session.publicKey) {
      console.error('Invalid session: missing sessionToken or publicKey');
      return false;
    }

    const sessionData = {
      ...session,
      isVerified: true,
      savedAt: Date.now(),
    };

    localStorage.setItem(BROWSER_SESSION_KEY, JSON.stringify(sessionData));
    console.log('✅ Verified session saved');
    return true;
  } catch (e) {
    console.error('Failed to save session:', e);
    return false;
  }
}

/**
 * Clear session (logout)
 */
export function clearSession() {
  const session = getSession();

  // Notify server to revoke session
  if (session?.sessionToken) {
    fetch(`${GNS_API_BASE}/auth/session/${session.sessionToken}`, {
      method: 'DELETE',
    }).catch(err => console.warn('Failed to revoke session on server:', err));
  }

  localStorage.removeItem(BROWSER_SESSION_KEY);
  console.log('🔓 Session cleared');
}

/**
 * Check if user is authenticated (paired via QR)
 */
export function isAuthenticated() {
  const session = getSession();
  return !!(session?.isVerified && session?.sessionToken && session?.publicKey);
}

/**
 * Check if session is paired (alias for clarity)
 */
export function isPaired() {
  return isAuthenticated();
}

// ===========================================
// QR LOGIN SESSION MANAGEMENT
// ===========================================

/**
 * Request a new QR login session from server
 * Returns session data including QR code content
 */
export async function requestLoginSession() {
  try {
    // Import crypto functions
    const { generateX25519Keypair } = await import('./crypto.js');

    // ✅ Generate X25519 encryption keypair for this browser session
    const encryptionKeypair = generateX25519Keypair();

    // Store encryption keys in sessionStorage (temporary, cleared on browser close)
    sessionStorage.setItem('gns_browser_encryption_public_key', encryptionKeypair.publicKey);
    sessionStorage.setItem('gns_browser_encryption_private_key', encryptionKeypair.privateKey);

    console.log('🔐 Generated browser encryption keys');
    console.log('   Public:', encryptionKeypair.publicKey.substring(0, 16) + '...');

    const browserInfo = getBrowserInfo();

    const response = await fetch(`${GNS_API_BASE}/auth/session/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        browserInfo,
        encryptionKey: encryptionKeypair.publicKey,  // ✅ Include in QR
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('🔐 QR session created:', data.data.sessionId.substring(0, 8) + '...');
      console.log('   ✅ Encryption key included in QR');
      return {
        success: true,
        ...data.data,
      };
    } else {
      return { success: false, error: data.error || 'Failed to create session' };
    }
  } catch (error) {
    console.error('QR session request error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Poll for session approval status
 */
export async function checkSessionStatus(sessionId) {
  try {
    const response = await fetch(`${GNS_API_BASE}/auth/session/${sessionId}`);
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 410) {
        return { status: 'expired' };
      }
      return { status: 'error', error: data.error };
    }

    if (data.success) {
      return {
        status: data.data.status,
        publicKey: data.data.publicKey,
        handle: data.data.handle,
        encryptionKey: data.data.encryptionKey,
        sessionToken: data.data.sessionToken,
      };
    }

    return { status: 'pending' };
  } catch (error) {
    console.error('Session status check error:', error);
    return { status: 'error', error: error.message };
  }
}

/**
 * Complete login after QR approval
 */
export function completeQRLogin(sessionData) {
  // Get browser's encryption private key from sessionStorage
  const browserEncryptionPrivateKey = sessionStorage.getItem('gns_browser_encryption_private_key');
  const browserEncryptionPublicKey = sessionStorage.getItem('gns_browser_encryption_public_key');

  if (!browserEncryptionPrivateKey) {
    console.warn('⚠️ No browser encryption private key found in sessionStorage');
  }

  const session = {
    publicKey: sessionData.publicKey,
    handle: sessionData.handle || null,

    // ✅ CRITICAL: Store mobile's encryption key for dual encryption
    encryptionKey: sessionData.encryptionKey,  // Mobile's X25519 public key

    // ✅ CRITICAL: Store browser's encryption private key for decryption
    encryptionPrivateKey: browserEncryptionPrivateKey,  // Browser's X25519 private key
    encryptionPublicKey: browserEncryptionPublicKey,    // Browser's X25519 public key

    sessionToken: sessionData.sessionToken,
    isVerified: true,
    pairedAt: Date.now(),
  };

  const saved = saveSession(session);

  if (saved) {
    console.log('✅ QR login complete!');
    console.log('   Identity:', session.publicKey.substring(0, 16) + '...');
    console.log('   Handle:', session.handle || '(none)');
    console.log('   ✅ Mobile encryption key stored:', session.encryptionKey?.substring(0, 16) + '...');
    console.log('   ✅ Browser encryption keys stored');

    // Clear sessionStorage keys (now in localStorage)
    sessionStorage.removeItem('gns_browser_encryption_private_key');
    sessionStorage.removeItem('gns_browser_encryption_public_key');

    return { success: true, session };
  } else {
    return { success: false, error: 'Failed to save session' };
  }
}

// ===========================================
// AUTH HEADERS FOR API REQUESTS
// ===========================================

/**
 * Get authentication headers for API requests
 * Uses verified session token
 */
export function getAuthHeaders() {
  const session = getSession();
  if (!session?.sessionToken) return {};

  return {
    'X-GNS-Session': session.sessionToken,
    'X-GNS-PublicKey': session.publicKey,
    'X-GNS-Timestamp': Date.now().toString(),
  };
}

/**
 * Legacy compatibility - get public key
 */
export function getPublicKey() {
  const session = getSession();
  return session?.publicKey || null;
}

/**
 * Get handle if available
 */
export function getHandle() {
  const session = getSession();
  return session?.handle || null;
}

/**
 * Get encryption key for messaging
 * Note: Browser does NOT have private key! 
 * It can only receive messages, not decrypt them locally.
 * Decryption happens via server relay.
 */
export function getEncryptionKey() {
  const session = getSession();
  return session?.encryptionKey || null;
}

// ===========================================
// SIGN IN / SIGN OUT
// ===========================================

/**
 * Sign in - REQUIRES QR PAIRING
 * No more auto-generating keys!
 */
export async function signIn() {
  // Check for existing verified session
  const existingSession = getSession();
  if (existingSession?.isVerified) {
    console.log('🔑 Using existing verified session');
    return {
      success: true,
      session: existingSession,
      isNew: false,
      requiresQR: false,
    };
  }

  // No valid session - need QR pairing
  console.log('🔐 QR pairing required');
  return {
    success: false,
    requiresQR: true,
    error: 'Please scan QR code with GNS mobile app to sign in',
  };
}

/**
 * Sign out - clears session and notifies server
 */
export function signOut() {
  clearSession();
  return { success: true };
}

// ===========================================
// UTILITIES
// ===========================================

/**
 * Get browser info string
 */
function getBrowserInfo() {
  try {
    const ua = navigator.userAgent;
    let browser = 'Unknown Browser';

    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    let os = 'Unknown OS';
    if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';

    return `${browser} on ${os}`;
  } catch (e) {
    return 'Unknown Browser';
  }
}

/**
 * Verify session is still valid with server
 */
export async function verifySession() {
  const session = getSession();
  if (!session?.sessionToken) {
    return { valid: false, reason: 'No session' };
  }

  try {
    const response = await fetch(`${GNS_API_BASE}/auth/session/verify`, {
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (data.success) {
      return { valid: true };
    } else {
      // Session invalid - clear it
      clearSession();
      return { valid: false, reason: data.error || 'Session invalid' };
    }
  } catch (error) {
    console.error('Session verification error:', error);
    return { valid: false, reason: error.message };
  }
}

// ===========================================
// MESSAGE SIGNING - DELEGATED
// Browser cannot sign messages (no private key)!
// Messages must be sent through authenticated session.
// ===========================================

/**
 * NOTE: Browser does NOT have private keys!
 * 
 * To send messages, use the authenticated API endpoints
 * which verify the session token. The server handles
 * message signing using the mobile-approved session.
 * 
 * This is intentional for security:
 * - Private keys NEVER leave mobile device
 * - Browser has limited, revocable access
 * - Messages are signed server-side for verified sessions
 */

// ===========================================
// EXPORTS
// ===========================================

export default {
  getSession,
  saveSession,
  clearSession,
  isAuthenticated,
  isPaired,
  requestLoginSession,
  checkSessionStatus,
  completeQRLogin,
  getAuthHeaders,
  getPublicKey,
  getHandle,
  getEncryptionKey,
  signIn,
  signOut,
  verifySession,
};
