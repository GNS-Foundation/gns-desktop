// ===========================================
// GNS NODE - CALLS API
// Voice & Video Call Infrastructure
//
// Endpoints:
// - POST /calls/turn-credentials - Get TURN server credentials
// - POST /calls/signal - HTTP fallback for call signaling
// - GET  /calls/can-call/:publicKey - Check call reachability
//
// WebSocket call signal types (handled in messages.ts):
// - call_offer, call_answer, call_ice
// - call_hangup, call_busy, call_reject, call_ringing
//
// Location: routes/calls.ts
// ===========================================

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as db from '../lib/db';
import { ApiResponse } from '../types';
import { isValidPublicKey } from '../lib/crypto';

const router = Router();

// ===========================================
// CONFIGURATION
// ===========================================

// TURN shared secret — must match coturn --static-auth-secret
const TURN_SHARED_SECRET = process.env.TURN_SHARED_SECRET || 'gns-turn-dev-secret';

// STUN servers (free, no auth)
const STUN_SERVERS = (
  process.env.STUN_SERVERS ||
  'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'
).split(',').filter(Boolean);

// TURN servers (require credentials)
const TURN_SERVERS = (process.env.TURN_SERVERS || '')
  .split(',')
  .filter(Boolean);

// Credential TTL (seconds) — 24 hours default
const TURN_CREDENTIAL_TTL = parseInt(
  process.env.TURN_CREDENTIAL_TTL || '86400',
  10
);

// Call signal rate limit: max signals per minute per user
const SIGNAL_RATE_LIMIT = 60;
const signalCounts = new Map<string, { count: number; resetAt: number }>();

// ===========================================
// AUTHENTICATION MIDDLEWARE
// ===========================================

interface AuthenticatedRequest extends Request {
  gnsPublicKey?: string;
}

const verifyAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: Function
) => {
  try {
    // Session token auth (QR pairing — preferred)
    const sessionToken = req.headers['x-gns-session'] as string;
    const publicKey = (
      req.headers['x-gns-publickey'] as string
    )?.toLowerCase();

    if (sessionToken && publicKey) {
      const session = await db.getBrowserSession(sessionToken);
      if (
        session &&
        session.public_key?.toLowerCase() === publicKey &&
        session.status === 'approved'
      ) {
        req.gnsPublicKey = publicKey;
        return next();
      }
    }

    // Legacy Ed25519 header auth
    const pk =
      publicKey ||
      (req.headers['x-gns-identity'] as string)?.toLowerCase();

    if (pk && isValidPublicKey(pk)) {
      req.gnsPublicKey = pk;
      return next();
    }

    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    } as ApiResponse);
  } catch (error) {
    console.error('Call auth error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
    } as ApiResponse);
  }
};

// ===========================================
// RATE LIMITER
// ===========================================

function checkRateLimit(publicKey: string): boolean {
  const now = Date.now();
  const entry = signalCounts.get(publicKey);

  if (!entry || now > entry.resetAt) {
    signalCounts.set(publicKey, {
      count: 1,
      resetAt: now + 60_000,
    });
    return true;
  }

  if (entry.count >= SIGNAL_RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// Periodic cleanup of rate limit map
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of signalCounts.entries()) {
    if (now > entry.resetAt) {
      signalCounts.delete(key);
    }
  }
}, 120_000);

// ===========================================
// POST /calls/turn-credentials
//
// Generate time-limited TURN credentials using
// RFC 8489 compatible HMAC-based authentication.
//
// coturn validates:
//   1. Extract timestamp prefix from username
//   2. Check timestamp > current time
//   3. Verify HMAC-SHA1(secret, username) == credential
// ===========================================

router.post(
  '/turn-credentials',
  verifyAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const publicKey = req.gnsPublicKey!;

      // Expiry = now + TTL
      const expiryTimestamp =
        Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL;

      // Username: "{expiry}:{identifier}" — coturn extracts the timestamp prefix
      const username = `${expiryTimestamp}:${publicKey.substring(0, 16)}`;

      // HMAC-SHA1 credential (coturn --use-auth-secret format)
      const credential = crypto
        .createHmac('sha1', TURN_SHARED_SECRET)
        .update(username)
        .digest('base64');

      // Build ICE server list for WebRTC
      const iceServers: any[] = [];

      // STUN — always included, free
      if (STUN_SERVERS.length > 0) {
        iceServers.push({ urls: STUN_SERVERS });
      }

      // TURN — with ephemeral credentials
      if (TURN_SERVERS.length > 0) {
        iceServers.push({
          urls: TURN_SERVERS,
          username,
          credential,
        });
      }

      console.log(
        `📞 TURN credentials issued: ${publicKey.substring(0, 16)}... ` +
        `(TTL: ${TURN_CREDENTIAL_TTL}s, ` +
        `${iceServers.length} server groups)`
      );

      return res.json({
        success: true,
        data: {
          iceServers,
          ttl: TURN_CREDENTIAL_TTL,
          expiresAt: expiryTimestamp * 1000, // ms for JS clients
        },
      } as ApiResponse);
    } catch (error) {
      console.error('POST /calls/turn-credentials error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate TURN credentials',
      } as ApiResponse);
    }
  }
);

// ===========================================
// POST /calls/signal
//
// HTTP fallback for call signaling.
// Primary signaling is via WebSocket — this endpoint
// is used when the WebSocket is temporarily disconnected
// or for the initial call setup.
// ===========================================

const VALID_SIGNAL_TYPES = new Set([
  'call_offer',
  'call_answer',
  'call_ice',
  'call_hangup',
  'call_busy',
  'call_reject',
  'call_ringing',
]);

router.post(
  '/signal',
  verifyAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { targetPublicKey, signalType, payload } = req.body;
      const senderPk = req.gnsPublicKey!;

      // Validate target
      if (!targetPublicKey || !isValidPublicKey(targetPublicKey)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid target public key',
        } as ApiResponse);
      }

      // Validate signal type
      if (!VALID_SIGNAL_TYPES.has(signalType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid signal type. Valid: ${[...VALID_SIGNAL_TYPES].join(', ')}`,
        } as ApiResponse);
      }

      // Validate payload
      if (!payload || !payload.callId) {
        return res.status(400).json({
          success: false,
          error: 'Missing payload or callId',
        } as ApiResponse);
      }

      // Rate limit
      if (!checkRateLimit(senderPk)) {
        return res.status(429).json({
          success: false,
          error: 'Too many call signals. Try again in a moment.',
        } as ApiResponse);
      }

      // Forward signal to recipient via WebSocket
      // Dynamic import to avoid circular dependency
      const { notifyRecipients } = require('./messages');

      notifyRecipients([targetPublicKey.toLowerCase()], {
        type: signalType,
        fromPublicKey: senderPk,
        callId: payload.callId,
        payload,
        timestamp: Date.now(),
      });

      console.log(
        `📞 Signal [${signalType}]: ` +
        `${senderPk.substring(0, 8)}... → ` +
        `${targetPublicKey.substring(0, 8)}...`
      );

      return res.json({
        success: true,
        data: {
          signalType,
          callId: payload.callId,
        },
      } as ApiResponse);
    } catch (error) {
      console.error('POST /calls/signal error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to send call signal',
      } as ApiResponse);
    }
  }
);

// ===========================================
// GET /calls/can-call/:publicKey
//
// Quick check: is the target user online and
// reachable for a call?
// ===========================================

router.get(
  '/can-call/:publicKey',
  verifyAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const targetPk = req.params.publicKey?.toLowerCase();

      if (!targetPk || !isValidPublicKey(targetPk)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid public key',
        } as ApiResponse);
      }

      // Check presence
      const presence = await db.getPresence(targetPk);
      const isOnline =
        presence?.status === 'online' || presence?.status === 'away';

      return res.json({
        success: true,
        data: {
          publicKey: targetPk,
          canCall: isOnline,
          presenceStatus: presence?.status || 'offline',
          lastSeen: presence?.lastSeen || null,
        },
      } as ApiResponse);
    } catch (error) {
      console.error('GET /calls/can-call error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to check call availability',
      } as ApiResponse);
    }
  }
);

// ===========================================
// EXPORTED: WebSocket call signal handler
//
// Called from messages.ts handleWebSocketMessage
// for all call_* message types. Forwards the signal
// to the target user without storing it.
// ===========================================

export function handleCallSignal(
  senderPublicKey: string,
  message: any,
  notifyFn: (publicKeys: string[], msg: any) => void
) {
  const targetPk = message.targetPublicKey?.toLowerCase();
  const callId = message.callId;

  if (!targetPk || !callId) {
    console.warn(
      '📞 Invalid call signal: missing targetPublicKey or callId'
    );
    return;
  }

  // Rate limit check
  if (!checkRateLimit(senderPublicKey)) {
    console.warn(`📞 Rate limited: ${senderPublicKey.substring(0, 8)}...`);
    return;
  }

  console.log(
    `📞 WS [${message.type}]: ` +
    `${senderPublicKey.substring(0, 8)}... → ` +
    `${targetPk.substring(0, 8)}...` +
    (callId ? ` (call: ${callId.substring(0, 8)}...)` : '')
  );

  // Forward signal to target user's connected devices
  notifyFn([targetPk], {
    type: message.type,
    fromPublicKey: senderPublicKey,
    callId,
    payload: message.payload || {},
    timestamp: Date.now(),
  });
}

// Valid call signal types (for messages.ts to check)
export const CALL_SIGNAL_TYPES = new Set([
  'call_offer',
  'call_answer',
  'call_ice',
  'call_hangup',
  'call_busy',
  'call_reject',
  'call_ringing',
]);

export default router;
