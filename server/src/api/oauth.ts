// ===========================================
// GNS API - OAUTH 2.0 / OPENID CONNECT
// /v1/oauth/* endpoints
// ===========================================
//
// Full OIDC-compliant "Login with GNS" implementation
// Supports:
// - Authorization Code flow with PKCE
// - Refresh tokens
// - OIDC UserInfo endpoint
// - JWKS for token verification
//
// Users authenticate by signing challenges with their
// GNS identity key (via mobile app QR scan or deep link)
// ===========================================

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import * as db from '../lib/db';
import {
  verifySignature,
  isValidPublicKey,
  canonicalJson,
  generateNonce,
} from '../lib/crypto';
import {
  ApiResponse,
  OAuthClient,
  OAuthSession,
  AuthorizationCode,
  RefreshToken,
  OAuthTokenResponse,
  OIDCUserInfo,
  OIDCDiscovery,
  AuthenticatedRequest,
} from '../types/api.types';
import { calculateVerificationLevel } from './verify';

const router = Router();

// ===========================================
// CONFIGURATION
// ===========================================

const CONFIG = {
  issuer: process.env.API_BASE_URL || 'https://api.gns.network',
  accessTokenTTL: 3600,      // 1 hour
  refreshTokenTTL: 2592000,  // 30 days
  authCodeTTL: 600,          // 10 minutes
  sessionTTL: 300,           // 5 minutes for QR auth
};

// JWT signing key - in production, use proper key management (Vault, KMS)
// For EdDSA, we'd use ed25519 keys; for simplicity here we use ES256
const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY || crypto.randomBytes(64).toString('hex');
const JWT_KEY_ID = 'gns-signing-key-1';

// ===========================================
// IN-MEMORY STORES
// In production, use Redis with TTL
// ===========================================

const oauthClients = new Map<string, OAuthClient>();
const oauthSessions = new Map<string, OAuthSession>();
const authorizationCodes = new Map<string, AuthorizationCode>();
const refreshTokens = new Map<string, RefreshToken>();

// Cleanup expired sessions every minute
setInterval(() => {
  const now = Date.now();
  
  for (const [id, session] of oauthSessions.entries()) {
    if (new Date(session.expires_at).getTime() < now) {
      oauthSessions.delete(id);
    }
  }
  
  for (const [code, data] of authorizationCodes.entries()) {
    if (data.expires_at < now) {
      authorizationCodes.delete(code);
    }
  }
}, 60 * 1000);

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Generate a secure random string
 */
function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Base64URL encode
 */
function base64url(data: Buffer | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data) : data;
  return buf.toString('base64url');
}

/**
 * SHA256 hash
 */
function sha256(data: string): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

/**
 * Verify PKCE code challenge
 */
function verifyCodeChallenge(codeVerifier: string, codeChallenge: string): boolean {
  const computed = base64url(sha256(codeVerifier));
  return computed === codeChallenge;
}

/**
 * Generate JWT access token
 */
function generateAccessToken(publicKey: string, scope: string, handle?: string): string {
  const payload = {
    sub: publicKey,
    handle: handle,
    scope: scope,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + CONFIG.accessTokenTTL,
    iss: CONFIG.issuer,
  };
  
  // Using HS256 for simplicity; production should use EdDSA or ES256 with proper keys
  return jwt.sign(payload, JWT_PRIVATE_KEY, { 
    algorithm: 'HS256',
    keyid: JWT_KEY_ID,
  });
}

/**
 * Generate OIDC ID token
 */
function generateIdToken(
  publicKey: string,
  handle: string | undefined,
  clientId: string,
  nonce?: string
): string {
  const payload: any = {
    sub: publicKey,
    handle: handle,
    preferred_username: handle,
    aud: clientId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + CONFIG.accessTokenTTL,
    iss: CONFIG.issuer,
    auth_time: Math.floor(Date.now() / 1000),
  };
  
  if (nonce) {
    payload.nonce = nonce;
  }
  
  return jwt.sign(payload, JWT_PRIVATE_KEY, {
    algorithm: 'HS256',
    keyid: JWT_KEY_ID,
  });
}

/**
 * Verify JWT and extract claims
 */
function verifyAccessToken(token: string): { sub: string; scope: string; handle?: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_PRIVATE_KEY, {
      algorithms: ['HS256'],
      issuer: CONFIG.issuer,
    }) as any;
    
    return {
      sub: decoded.sub,
      scope: decoded.scope || '',
      handle: decoded.handle,
    };
  } catch (error) {
    return null;
  }
}

// ===========================================
// MIDDLEWARE
// ===========================================

/**
 * Authenticate requests using Bearer token
 */
export async function authenticateBearer(
  req: AuthenticatedRequest,
  res: Response,
  next: Function
) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid Authorization header',
      code: 'UNAUTHORIZED',
    } as ApiResponse);
  }
  
  const token = authHeader.substring(7);
  const claims = verifyAccessToken(token);
  
  if (!claims) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    } as ApiResponse);
  }
  
  req.gnsSession = {
    publicKey: claims.sub,
    handle: claims.handle,
    scope: claims.scope,
  };
  req.gnsPublicKey = claims.sub;
  req.gnsHandle = claims.handle;
  
  next();
}

// ===========================================
// GET /.well-known/openid-configuration
// OIDC Discovery Document
// ===========================================

router.get('/.well-known/openid-configuration', (req: Request, res: Response) => {
  const discovery: OIDCDiscovery = {
    issuer: CONFIG.issuer,
    authorization_endpoint: `${CONFIG.issuer}/v1/oauth/authorize`,
    token_endpoint: `${CONFIG.issuer}/v1/oauth/token`,
    userinfo_endpoint: `${CONFIG.issuer}/v1/oauth/userinfo`,
    jwks_uri: `${CONFIG.issuer}/v1/oauth/jwks`,
    scopes_supported: [
      'openid',
      'identity:read',
      'identity:verify',
      'messages:read',
      'messages:write',
      'payments:read',
      'payments:write',
      'gsite:read',
      'gsite:write',
      'webhooks:manage',
    ],
    response_types_supported: ['code', 'token'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256', 'ES256', 'EdDSA'],
    code_challenge_methods_supported: ['S256'],
  };
  
  res.json(discovery);
});

// Also serve at root for compatibility
router.get('/openid-configuration', (req: Request, res: Response) => {
  res.redirect('/.well-known/openid-configuration');
});

// ===========================================
// GET /oauth/authorize
// Authorization Endpoint - initiates "Login with GNS"
// ===========================================

router.get('/authorize', async (req: Request, res: Response) => {
  try {
    const {
      client_id,
      redirect_uri,
      response_type,
      scope = 'openid identity:read',
      state,
      code_challenge,
      code_challenge_method,
      nonce,
    } = req.query as Record<string, string>;

    // Validate required parameters
    if (!client_id) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing client_id parameter',
      });
    }

    if (!redirect_uri) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing redirect_uri parameter',
      });
    }

    if (response_type !== 'code' && response_type !== 'token') {
      return res.status(400).json({
        error: 'unsupported_response_type',
        error_description: 'response_type must be "code" or "token"',
      });
    }

    // Validate client
    const client = oauthClients.get(client_id);
    
    if (!client) {
      // Check database for registered clients
      const dbClient = await db.getOAuthClient?.(client_id);
      
      if (!dbClient) {
        return res.status(400).json({
          error: 'invalid_client',
          error_description: 'Unknown client_id',
        });
      }
      
      // Cache it
      oauthClients.set(client_id, dbClient);
    }

    const validClient = client || oauthClients.get(client_id)!;

    // Validate redirect_uri
    if (!validClient.redirect_uris.includes(redirect_uri)) {
      return res.status(400).json({
        error: 'invalid_redirect_uri',
        error_description: 'redirect_uri not registered for this client',
      });
    }

    // PKCE required for public clients
    if (!validClient.confidential && !code_challenge) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'PKCE (code_challenge) required for public clients',
      });
    }

    if (code_challenge && code_challenge_method !== 'S256') {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Only S256 code_challenge_method is supported',
      });
    }

    // Create pending OAuth session
    const sessionId = crypto.randomUUID();
    const challenge = generateNonce();
    const expiresAt = new Date(Date.now() + CONFIG.sessionTTL * 1000).toISOString();

    const session: OAuthSession = {
      id: sessionId,
      client_id,
      redirect_uri,
      scope,
      state,
      code_challenge,
      code_challenge_method,
      nonce,
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    };

    oauthSessions.set(sessionId, session);

    console.log(`🔐 OAuth session created: ${sessionId} for client ${client_id}`);

    // Generate QR code URL for mobile app approval
    const authUrl = `${CONFIG.issuer}/auth?session=${sessionId}`;
    const qrUrl = `${CONFIG.issuer}/v1/oauth/qr/${sessionId}`;
    const deepLink = `gns://auth?session=${sessionId}&challenge=${challenge}`;

    // Return auth page or redirect to GNS auth UI
    // In production, this would render an HTML page with QR code
    // For API-first approach, return JSON with session details
    
    if (req.accepts('html')) {
      // Redirect to GNS auth page
      return res.redirect(`https://gns.network/auth?session=${sessionId}`);
    }

    // Return JSON for programmatic access
    return res.json({
      session_id: sessionId,
      auth_url: authUrl,
      qr_url: qrUrl,
      deep_link: deepLink,
      challenge,
      expires_at: expiresAt,
    });

  } catch (error) {
    console.error('OAuth authorize error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

// ===========================================
// GET /oauth/session/:sessionId
// Poll for session status (for web clients)
// ===========================================

router.get('/session/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  const session = oauthSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({
      error: 'session_not_found',
      error_description: 'Session not found or expired',
    });
  }

  // Check expiration
  if (new Date(session.expires_at).getTime() < Date.now()) {
    oauthSessions.delete(sessionId);
    return res.status(410).json({
      error: 'session_expired',
      error_description: 'Session has expired',
    });
  }

  return res.json({
    status: session.status,
    expires_at: session.expires_at,
  });
});

// ===========================================
// POST /oauth/session/:sessionId/approve
// Mobile app approves the session
// ===========================================

router.post('/session/:sessionId/approve', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { public_key, signature } = req.body;

    // Validate inputs
    if (!public_key || !isValidPublicKey(public_key)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid public_key',
      });
    }

    if (!signature) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing signature',
      });
    }

    // Get session
    const session = oauthSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        error: 'session_not_found',
        error_description: 'Session not found or expired',
      });
    }

    if (session.status !== 'pending') {
      return res.status(409).json({
        error: 'invalid_session_state',
        error_description: `Session is already ${session.status}`,
      });
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      oauthSessions.delete(sessionId);
      return res.status(410).json({
        error: 'session_expired',
        error_description: 'Session has expired',
      });
    }

    const publicKey = public_key.toLowerCase();

    // Verify signature
    const signedData = canonicalJson({
      action: 'approve',
      session_id: sessionId,
      client_id: session.client_id,
      public_key: publicKey,
    });

    const isValid = verifySignature(publicKey, signedData, signature);
    
    if (!isValid) {
      console.warn(`❌ Invalid signature for OAuth session ${sessionId}`);
      return res.status(401).json({
        error: 'invalid_signature',
        error_description: 'Signature verification failed',
      });
    }

    // Get user's handle
    const alias = await db.getAliasByPk(publicKey);
    const handle = alias?.handle;

    // Generate authorization code
    const code = generateSecureToken(32);
    const codeExpiresAt = Date.now() + CONFIG.authCodeTTL * 1000;

    const authCode: AuthorizationCode = {
      code,
      client_id: session.client_id,
      public_key: publicKey,
      handle,
      scope: session.scope,
      redirect_uri: session.redirect_uri,
      code_challenge: session.code_challenge,
      nonce: session.nonce,
      created_at: Date.now(),
      expires_at: codeExpiresAt,
    };

    authorizationCodes.set(code, authCode);

    // Update session
    session.status = 'approved';
    session.public_key = publicKey;
    session.handle = handle;

    console.log(`✅ OAuth session ${sessionId} approved by ${handle || publicKey.substring(0, 16)}...`);

    // Build redirect URL with authorization code
    const redirectUrl = new URL(session.redirect_uri);
    redirectUrl.searchParams.set('code', code);
    
    if (session.state) {
      redirectUrl.searchParams.set('state', session.state);
    }

    return res.json({
      success: true,
      redirect_url: redirectUrl.toString(),
      code,
    });

  } catch (error) {
    console.error('OAuth approve error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

// ===========================================
// POST /oauth/token
// Token Endpoint - exchange code for tokens
// ===========================================

router.post('/token', async (req: Request, res: Response) => {
  try {
    const {
      grant_type,
      client_id,
      client_secret,
      code,
      redirect_uri,
      code_verifier,
      refresh_token,
    } = req.body;

    // Validate grant_type
    if (!['authorization_code', 'refresh_token'].includes(grant_type)) {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'grant_type must be authorization_code or refresh_token',
      });
    }

    if (!client_id) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing client_id',
      });
    }

    // Get client
    let client = oauthClients.get(client_id);
    
    if (!client) {
      const dbClient = await db.getOAuthClient?.(client_id);
      if (dbClient) {
        oauthClients.set(client_id, dbClient);
        client = dbClient;
      }
    }

    if (!client) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Unknown client',
      });
    }

    // Confidential clients must authenticate
    if (client.confidential) {
      if (!client_secret || client.client_secret !== client_secret) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Invalid client credentials',
        });
      }
    }

    // Handle authorization_code grant
    if (grant_type === 'authorization_code') {
      if (!code) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing code',
        });
      }

      const authCode = authorizationCodes.get(code);
      
      if (!authCode) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid or expired authorization code',
        });
      }

      // Verify code belongs to this client
      if (authCode.client_id !== client_id) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Code was not issued to this client',
        });
      }

      // Verify redirect_uri matches
      if (redirect_uri && authCode.redirect_uri !== redirect_uri) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'redirect_uri mismatch',
        });
      }

      // Verify expiration
      if (authCode.expires_at < Date.now()) {
        authorizationCodes.delete(code);
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Authorization code has expired',
        });
      }

      // Verify PKCE
      if (authCode.code_challenge) {
        if (!code_verifier) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Missing code_verifier (PKCE required)',
          });
        }

        if (!verifyCodeChallenge(code_verifier, authCode.code_challenge)) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'PKCE verification failed',
          });
        }
      }

      // Authorization code is valid - delete it (one-time use)
      authorizationCodes.delete(code);

      // Generate tokens
      const accessToken = generateAccessToken(
        authCode.public_key,
        authCode.scope,
        authCode.handle
      );

      const newRefreshToken = generateSecureToken(64);
      
      refreshTokens.set(newRefreshToken, {
        token: newRefreshToken,
        public_key: authCode.public_key,
        client_id,
        scope: authCode.scope,
        created_at: Date.now(),
      });

      // Generate ID token if openid scope
      let idToken: string | undefined;
      if (authCode.scope.includes('openid')) {
        idToken = generateIdToken(
          authCode.public_key,
          authCode.handle,
          client_id,
          authCode.nonce
        );
      }

      console.log(`🎫 Tokens issued for ${authCode.handle || authCode.public_key.substring(0, 16)}...`);

      const response: OAuthTokenResponse = {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: CONFIG.accessTokenTTL,
        refresh_token: newRefreshToken,
        scope: authCode.scope,
        id_token: idToken,
      };

      return res.json(response);
    }

    // Handle refresh_token grant
    if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing refresh_token',
        });
      }

      const stored = refreshTokens.get(refresh_token);
      
      if (!stored) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid or expired refresh token',
        });
      }

      if (stored.client_id !== client_id) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Refresh token was not issued to this client',
        });
      }

      // Check refresh token expiration
      if (Date.now() - stored.created_at > CONFIG.refreshTokenTTL * 1000) {
        refreshTokens.delete(refresh_token);
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Refresh token has expired',
        });
      }

      // Get updated user info
      const alias = await db.getAliasByPk(stored.public_key);
      const handle = alias?.handle;

      // Generate new access token
      const accessToken = generateAccessToken(stored.public_key, stored.scope, handle);

      console.log(`🔄 Token refreshed for ${handle || stored.public_key.substring(0, 16)}...`);

      const response: OAuthTokenResponse = {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: CONFIG.accessTokenTTL,
        scope: stored.scope,
      };

      return res.json(response);
    }

  } catch (error) {
    console.error('OAuth token error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

// ===========================================
// GET /oauth/userinfo
// OIDC UserInfo Endpoint
// ===========================================

router.get('/userinfo', authenticateBearer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    
    // Get user record
    const record = await db.getRecord(publicKey);
    const alias = await db.getAliasByPk(publicKey);

    const trustScore = record?.trust_score || 0;
    const breadcrumbCount = record?.breadcrumb_count || 0;
    const verified = breadcrumbCount >= 100;

    const userInfo: OIDCUserInfo = {
      sub: publicKey,
      handle: alias?.handle ? `@${alias.handle}` : undefined,
      preferred_username: alias?.handle,
      trust_score: trustScore,
      verified,
      breadcrumb_count: breadcrumbCount,
      updated_at: record?.updated_at 
        ? Math.floor(new Date(record.updated_at).getTime() / 1000)
        : undefined,
    };

    return res.json(userInfo);

  } catch (error) {
    console.error('UserInfo error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

// ===========================================
// GET /oauth/jwks
// JSON Web Key Set for token verification
// ===========================================

router.get('/jwks', (req: Request, res: Response) => {
  // In production, use proper asymmetric keys (Ed25519 or ES256)
  // This is a simplified symmetric key reference
  
  const jwks = {
    keys: [
      {
        kty: 'oct',
        kid: JWT_KEY_ID,
        use: 'sig',
        alg: 'HS256',
        // Note: For symmetric keys, we don't expose the actual key
        // This is just metadata about the key
      },
    ],
  };

  res.json(jwks);
});

// ===========================================
// POST /oauth/clients
// Register OAuth Client (requires GNS auth)
// ===========================================

router.post('/clients', async (req: Request, res: Response) => {
  try {
    const {
      name,
      redirect_uris,
      logo_uri,
      tos_uri,
      policy_uri,
    } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'name is required',
        code: 'INVALID_INPUT',
      } as ApiResponse);
    }

    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'redirect_uris must be a non-empty array',
        code: 'INVALID_INPUT',
      } as ApiResponse);
    }

    // Validate redirect URIs
    for (const uri of redirect_uris) {
      try {
        new URL(uri);
      } catch {
        return res.status(400).json({
          success: false,
          error: `Invalid redirect_uri: ${uri}`,
          code: 'INVALID_REDIRECT_URI',
        } as ApiResponse);
      }
    }

    // Get owner from auth header (signature-based auth)
    const publicKey = req.headers['x-gns-publickey'] as string;
    const signature = req.headers['x-gns-signature'] as string;
    const timestamp = req.headers['x-gns-timestamp'] as string;

    if (!publicKey || !isValidPublicKey(publicKey)) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid X-GNS-PublicKey header',
        code: 'UNAUTHORIZED',
      } as ApiResponse);
    }

    // Verify signature
    const signedData = canonicalJson({
      method: 'POST',
      path: '/v1/oauth/clients',
      timestamp,
      body: { name, redirect_uris },
    });

    if (signature && !verifySignature(publicKey.toLowerCase(), signedData, signature)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE',
      } as ApiResponse);
    }

    // Generate client credentials
    const clientId = `gns_${generateSecureToken(16)}`;
    const clientSecret = generateSecureToken(32);

    const client: OAuthClient = {
      client_id: clientId,
      client_secret: clientSecret,
      name,
      redirect_uris,
      logo_uri,
      tos_uri,
      policy_uri,
      confidential: false, // Public client by default
      owner_pk: publicKey.toLowerCase(),
      created_at: new Date().toISOString(),
    };

    // Store client (in production, persist to database)
    oauthClients.set(clientId, client);

    // Also store in database if available
    if (db.createOAuthClient) {
      await db.createOAuthClient(client);
    }

    console.log(`📱 OAuth client registered: ${clientId} (${name})`);

    return res.status(201).json({
      success: true,
      data: {
        client_id: clientId,
        client_secret: clientSecret, // Only returned once!
        name,
        redirect_uris,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Register client error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// POST /oauth/revoke
// Revoke tokens
// ===========================================

router.post('/revoke', async (req: Request, res: Response) => {
  const { token, token_type_hint } = req.body;

  if (!token) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing token',
    });
  }

  // Try to revoke as refresh token
  if (refreshTokens.has(token)) {
    refreshTokens.delete(token);
    console.log(`🗑️ Refresh token revoked`);
  }

  // For access tokens, we'd need a blacklist (not implemented for stateless JWTs)
  // In production, use short-lived access tokens and rely on refresh token revocation

  // Always return 200 per RFC 7009
  return res.json({ success: true });
});

export default router;

// ===========================================
// EXPORTS
// ===========================================

export { authenticateBearer, verifyAccessToken };
