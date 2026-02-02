// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — Auth Context Provider
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/AuthProvider.tsx
//
// Wraps the existing GNS QR-based auth system into React context.
// No key generation in browser — identity verified via mobile app
// QR scan. Private keys NEVER leave the mobile device.
//
// Session stored in localStorage as 'gns_browser_session'.
// ═══════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = 'https://gns-browser-production.up.railway.app';
const BROWSER_SESSION_KEY = 'gns_browser_session';

// ─── Types ───

export interface GnsSession {
  publicKey: string;
  handle: string | null;
  sessionToken: string;
  encryptionKey?: string;       // Mobile's X25519 public key
  encryptionPrivateKey?: string; // Browser's X25519 private key
  encryptionPublicKey?: string;  // Browser's X25519 public key
  isVerified: boolean;
  pairedAt: number;
}

export interface AuthContextValue {
  /** Current authenticated session, or null */
  session: GnsSession | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Current handle (without @) */
  handle: string | null;
  /** Current public key */
  publicKey: string | null;
  /** Sign out — clears local session and revokes on server */
  signOut: () => void;
  /** Called by QRLoginModal on successful pairing */
  onLoginSuccess: (sessionData: any) => void;
  /** Auth headers for API requests */
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isAuthenticated: false,
  handle: null,
  publicKey: null,
  signOut: () => {},
  onLoginSuccess: () => {},
  getAuthHeaders: () => ({}),
});

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Provider ───

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<GnsSession | null>(null);

  // ─── Restore session from localStorage on mount ───
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BROWSER_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.isVerified && parsed.sessionToken && parsed.publicKey) {
          setSession(parsed as GnsSession);
          console.log('🔑 Session restored:', parsed.handle || parsed.publicKey.substring(0, 16));
        }
      }
    } catch (e) {
      console.error('Failed to restore session:', e);
    }
  }, []);

  // ─── Login success (called by QRLoginModal) ───
  const onLoginSuccess = useCallback((sessionData: any) => {
    const newSession: GnsSession = {
      publicKey: sessionData.publicKey,
      handle: sessionData.handle || null,
      sessionToken: sessionData.sessionToken,
      encryptionKey: sessionData.encryptionKey,
      encryptionPrivateKey: sessionData.encryptionPrivateKey,
      encryptionPublicKey: sessionData.encryptionPublicKey,
      isVerified: true,
      pairedAt: Date.now(),
    };

    try {
      localStorage.setItem(BROWSER_SESSION_KEY, JSON.stringify(newSession));
    } catch (e) {
      console.error('Failed to save session:', e);
    }

    setSession(newSession);
    console.log('✅ Login complete:', newSession.handle || newSession.publicKey.substring(0, 16));
  }, []);

  // ─── Sign out ───
  const signOut = useCallback(() => {
    // Notify server to revoke
    if (session?.sessionToken) {
      fetch(`${API_BASE}/auth/sessions/${session.sessionToken}`, {
        method: 'DELETE',
      }).catch(err => console.warn('Failed to revoke session on server:', err));
    }

    localStorage.removeItem(BROWSER_SESSION_KEY);
    setSession(null);
    console.log('🔓 Signed out');
  }, [session]);

  // ─── Auth headers for API requests ───
  const getAuthHeaders = useCallback(() => {
    if (!session?.sessionToken) return {};
    return {
      'X-GNS-Session': session.sessionToken,
      'X-GNS-PublicKey': session.publicKey,
      'X-GNS-Timestamp': Date.now().toString(),
    };
  }, [session]);

  const value: AuthContextValue = {
    session,
    isAuthenticated: !!(session?.isVerified && session?.sessionToken),
    handle: session?.handle || null,
    publicKey: session?.publicKey || null,
    signOut,
    onLoginSuccess,
    getAuthHeaders,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
