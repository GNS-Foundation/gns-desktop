// ===========================================
// GNS API - WEBHOOKS
// /v1/webhooks/* endpoints + Event Dispatch Service
// ===========================================
//
// Webhook subscriptions allow external applications to
// receive real-time notifications for GNS events.
//
// Events:
// - handle.claimed, handle.transferred
// - message.received, message.read
// - payment.received, payment.sent
// - payment.request.created, payment.request.completed, payment.request.expired
// - trust.threshold.reached
// - facet.activated, facet.deactivated
// - gsite.updated
// - org.member.added, org.member.removed
//
// Security:
// - Webhooks include HMAC-SHA256 signature in X-GNS-Signature header
// - Clients verify using their webhook secret
// ===========================================

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as db from '../lib/db';
import { verifySignature, isValidPublicKey, canonicalJson } from '../lib/crypto';
import {
  ApiResponse,
  WebhookSubscription,
  WebhookEventType,
  WebhookEvent,
  WebhookDelivery,
  CreateWebhookRequest,
  AuthenticatedRequest,
} from '../types/api.types';

const router = Router();

// ===========================================
// CONFIGURATION
// ===========================================

const CONFIG = {
  maxWebhooksPerUser: 10,
  maxRetries: 3,
  retryDelays: [1000, 5000, 30000], // 1s, 5s, 30s
  deliveryTimeout: 10000, // 10 seconds
  maxFailuresBeforeDisable: 10,
};

// ===========================================
// IN-MEMORY STORES
// In production, persist to database
// ===========================================

const webhookSubscriptions = new Map<string, WebhookSubscription>();
const webhookDeliveries = new Map<string, WebhookDelivery[]>();

// Index by owner for quick lookup
const webhooksByOwner = new Map<string, Set<string>>();

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Hash the webhook secret for storage
 */
function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Generate HMAC signature for webhook payload
 */
function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===========================================
// MIDDLEWARE - GNS Signature Auth
// ===========================================

async function authenticateGns(
  req: AuthenticatedRequest,
  res: Response,
  next: Function
) {
  const publicKey = (req.headers['x-gns-publickey'] as string)?.toLowerCase();
  const timestamp = req.headers['x-gns-timestamp'] as string;
  const signature = req.headers['x-gns-signature'] as string;

  if (!publicKey || !isValidPublicKey(publicKey)) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid X-GNS-PublicKey header',
      code: 'UNAUTHORIZED',
    } as ApiResponse);
  }

  // Verify timestamp is recent (within 5 minutes)
  if (timestamp) {
    const ts = parseInt(timestamp);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
      return res.status(401).json({
        success: false,
        error: 'Timestamp too old or invalid',
        code: 'TIMESTAMP_INVALID',
      } as ApiResponse);
    }
  }

  // Verify signature if provided
  if (signature) {
    const method = req.method;
    const path = req.path;
    const bodyHash = req.body 
      ? crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex')
      : '';

    const signedData = `${method}:${path}:${timestamp}:${bodyHash}`;
    
    if (!verifySignature(publicKey, signedData, signature)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE',
      } as ApiResponse);
    }
  }

  req.gnsPublicKey = publicKey;
  
  // Get handle if available
  const alias = await db.getAliasByPk(publicKey);
  req.gnsHandle = alias?.handle;

  next();
}

// ===========================================
// GET /webhooks
// List webhook subscriptions
// ===========================================

router.get('/', authenticateGns, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;

    // Get user's webhooks from memory
    const userWebhookIds = webhooksByOwner.get(publicKey) || new Set();
    const webhooks: WebhookSubscription[] = [];

    for (const id of userWebhookIds) {
      const webhook = webhookSubscriptions.get(id);
      if (webhook) {
        // Don't expose secret hash
        const { secret_hash, ...safe } = webhook;
        webhooks.push(safe as WebhookSubscription);
      }
    }

    // Also check database
    if (db.getWebhookSubscriptions) {
      const dbWebhooks = await db.getWebhookSubscriptions(publicKey);
      for (const w of dbWebhooks) {
        if (!webhooks.find(x => x.id === w.id)) {
          const { secret_hash, ...safe } = w;
          webhooks.push(safe as WebhookSubscription);
        }
      }
    }

    return res.json({
      success: true,
      data: webhooks,
    } as ApiResponse<WebhookSubscription[]>);

  } catch (error) {
    console.error('List webhooks error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// POST /webhooks
// Create webhook subscription
// ===========================================

router.post('/', authenticateGns, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const body = req.body as CreateWebhookRequest;

    // Validate target_url
    if (!body.target_url) {
      return res.status(400).json({
        success: false,
        error: 'target_url is required',
        code: 'INVALID_INPUT',
      } as ApiResponse);
    }

    try {
      const url = new URL(body.target_url);
      // Must be HTTPS in production
      if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
        return res.status(400).json({
          success: false,
          error: 'target_url must use HTTPS',
          code: 'INVALID_URL',
        } as ApiResponse);
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid target_url',
        code: 'INVALID_URL',
      } as ApiResponse);
    }

    // Validate events
    const validEvents: WebhookEventType[] = [
      'handle.claimed', 'handle.transferred',
      'message.received', 'message.read',
      'payment.received', 'payment.sent',
      'payment.request.created', 'payment.request.completed', 'payment.request.expired',
      'trust.threshold.reached',
      'facet.activated', 'facet.deactivated',
      'gsite.updated',
      'org.member.added', 'org.member.removed',
    ];

    if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'events must be a non-empty array',
        code: 'INVALID_INPUT',
      } as ApiResponse);
    }

    for (const event of body.events) {
      if (!validEvents.includes(event as WebhookEventType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid event type: ${event}. Valid types: ${validEvents.join(', ')}`,
          code: 'INVALID_EVENT',
        } as ApiResponse);
      }
    }

    // Validate secret
    if (!body.secret || body.secret.length < 16) {
      return res.status(400).json({
        success: false,
        error: 'secret must be at least 16 characters',
        code: 'INVALID_SECRET',
      } as ApiResponse);
    }

    // Check quota
    const userWebhookIds = webhooksByOwner.get(publicKey) || new Set();
    if (userWebhookIds.size >= CONFIG.maxWebhooksPerUser) {
      return res.status(429).json({
        success: false,
        error: `Maximum ${CONFIG.maxWebhooksPerUser} webhooks per user`,
        code: 'QUOTA_EXCEEDED',
      } as ApiResponse);
    }

    // Validate for_handle if provided
    if (body.for_handle) {
      const handlePk = await db.resolveHandleToPublicKey(body.for_handle);
      if (handlePk !== publicKey) {
        return res.status(403).json({
          success: false,
          error: 'You can only create webhooks for handles you own',
          code: 'FORBIDDEN',
        } as ApiResponse);
      }
    }

    // Create webhook
    const webhookId = crypto.randomUUID();
    const now = new Date().toISOString();

    const webhook: WebhookSubscription = {
      id: webhookId,
      owner_pk: publicKey,
      target_url: body.target_url,
      events: body.events as WebhookEventType[],
      for_handle: body.for_handle,
      secret_hash: hashSecret(body.secret),
      active: true,
      created_at: now,
      failure_count: 0,
    };

    // Store in memory
    webhookSubscriptions.set(webhookId, webhook);
    
    if (!webhooksByOwner.has(publicKey)) {
      webhooksByOwner.set(publicKey, new Set());
    }
    webhooksByOwner.get(publicKey)!.add(webhookId);

    // Store in database
    if (db.createWebhookSubscription) {
      await db.createWebhookSubscription(webhook);
    }

    console.log(`🪝 Webhook created: ${webhookId} for ${publicKey.substring(0, 16)}...`);
    console.log(`   URL: ${body.target_url}`);
    console.log(`   Events: ${body.events.join(', ')}`);

    // Return without secret_hash
    const { secret_hash, ...safeWebhook } = webhook;

    return res.status(201).json({
      success: true,
      data: safeWebhook,
    } as ApiResponse);

  } catch (error) {
    console.error('Create webhook error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// GET /webhooks/:webhookId
// Get webhook details
// ===========================================

router.get('/:webhookId', authenticateGns, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { webhookId } = req.params;
    const publicKey = req.gnsPublicKey!;

    const webhook = webhookSubscriptions.get(webhookId);
    
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found',
        code: 'NOT_FOUND',
      } as ApiResponse);
    }

    // Check ownership
    if (webhook.owner_pk !== publicKey) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'FORBIDDEN',
      } as ApiResponse);
    }

    const { secret_hash, ...safeWebhook } = webhook;

    return res.json({
      success: true,
      data: safeWebhook,
    } as ApiResponse);

  } catch (error) {
    console.error('Get webhook error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// PATCH /webhooks/:webhookId
// Update webhook subscription
// ===========================================

router.patch('/:webhookId', authenticateGns, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { webhookId } = req.params;
    const publicKey = req.gnsPublicKey!;
    const { target_url, events, active } = req.body;

    const webhook = webhookSubscriptions.get(webhookId);
    
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found',
        code: 'NOT_FOUND',
      } as ApiResponse);
    }

    // Check ownership
    if (webhook.owner_pk !== publicKey) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'FORBIDDEN',
      } as ApiResponse);
    }

    // Update fields
    if (target_url !== undefined) {
      try {
        new URL(target_url);
        webhook.target_url = target_url;
      } catch {
        return res.status(400).json({
          success: false,
          error: 'Invalid target_url',
          code: 'INVALID_URL',
        } as ApiResponse);
      }
    }

    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'events must be a non-empty array',
          code: 'INVALID_INPUT',
        } as ApiResponse);
      }
      webhook.events = events;
    }

    if (active !== undefined) {
      webhook.active = Boolean(active);
      if (active) {
        // Reset failure count when re-enabling
        webhook.failure_count = 0;
      }
    }

    // Update in database
    if (db.updateWebhookSubscription) {
      await db.updateWebhookSubscription(webhookId, {
        target_url: webhook.target_url,
        events: webhook.events,
        active: webhook.active,
      });
    }

    console.log(`🪝 Webhook updated: ${webhookId}`);

    const { secret_hash, ...safeWebhook } = webhook;

    return res.json({
      success: true,
      data: safeWebhook,
    } as ApiResponse);

  } catch (error) {
    console.error('Update webhook error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// DELETE /webhooks/:webhookId
// Delete webhook subscription
// ===========================================

router.delete('/:webhookId', authenticateGns, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { webhookId } = req.params;
    const publicKey = req.gnsPublicKey!;

    const webhook = webhookSubscriptions.get(webhookId);
    
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found',
        code: 'NOT_FOUND',
      } as ApiResponse);
    }

    // Check ownership
    if (webhook.owner_pk !== publicKey) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'FORBIDDEN',
      } as ApiResponse);
    }

    // Delete from memory
    webhookSubscriptions.delete(webhookId);
    webhooksByOwner.get(publicKey)?.delete(webhookId);

    // Delete from database
    if (db.deleteWebhookSubscription) {
      await db.deleteWebhookSubscription(webhookId);
    }

    console.log(`🗑️ Webhook deleted: ${webhookId}`);

    return res.status(204).send();

  } catch (error) {
    console.error('Delete webhook error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// POST /webhooks/:webhookId/test
// Send test event
// ===========================================

router.post('/:webhookId/test', authenticateGns, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { webhookId } = req.params;
    const publicKey = req.gnsPublicKey!;

    const webhook = webhookSubscriptions.get(webhookId);
    
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found',
        code: 'NOT_FOUND',
      } as ApiResponse);
    }

    // Check ownership
    if (webhook.owner_pk !== publicKey) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'FORBIDDEN',
      } as ApiResponse);
    }

    // Create test event
    const testEvent: WebhookEvent = {
      id: crypto.randomUUID(),
      event: 'test' as WebhookEventType,
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook event',
        webhook_id: webhookId,
      },
    };

    // Deliver synchronously and return result
    const result = await deliverWebhookSync(webhook, testEvent, req.body.secret);

    return res.json({
      success: true,
      data: {
        delivered: result.success,
        response_code: result.responseCode,
        response_time_ms: result.responseTime,
        error: result.error,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Test webhook error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// GET /webhooks/:webhookId/deliveries
// Get recent delivery history
// ===========================================

router.get('/:webhookId/deliveries', authenticateGns, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { webhookId } = req.params;
    const publicKey = req.gnsPublicKey!;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const webhook = webhookSubscriptions.get(webhookId);
    
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found',
        code: 'NOT_FOUND',
      } as ApiResponse);
    }

    // Check ownership
    if (webhook.owner_pk !== publicKey) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'FORBIDDEN',
      } as ApiResponse);
    }

    const deliveries = webhookDeliveries.get(webhookId) || [];
    const recent = deliveries.slice(-limit).reverse();

    return res.json({
      success: true,
      data: recent,
    } as ApiResponse);

  } catch (error) {
    console.error('Get deliveries error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

export default router;

// ===========================================
// WEBHOOK DISPATCH SERVICE
// ===========================================

/**
 * Deliver webhook synchronously (for testing)
 */
async function deliverWebhookSync(
  webhook: WebhookSubscription,
  event: WebhookEvent,
  secret?: string
): Promise<{
  success: boolean;
  responseCode?: number;
  responseTime?: number;
  error?: string;
}> {
  const body = JSON.stringify(event);
  
  // We need the original secret to sign, not the hash
  // For test endpoint, client must provide the secret
  if (!secret) {
    return { success: false, error: 'Secret required for test delivery' };
  }

  const signature = signWebhookPayload(body, secret);
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.deliveryTimeout);

    const response = await fetch(webhook.target_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GNS-Signature': `sha256=${signature}`,
        'X-GNS-Event': event.event,
        'X-GNS-Delivery': event.id,
        'User-Agent': 'GNS-Webhooks/1.0',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    return {
      success: response.ok,
      responseCode: response.status,
      responseTime,
    };

  } catch (error: any) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error.name === 'AbortError' ? 'Request timeout' : error.message,
    };
  }
}

/**
 * Dispatch webhook event to matching subscriptions
 * Called by other modules when events occur
 */
export async function dispatchWebhookEvent(
  targetPk: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  // Find matching subscriptions
  const userWebhookIds = webhooksByOwner.get(targetPk) || new Set();
  
  for (const webhookId of userWebhookIds) {
    const webhook = webhookSubscriptions.get(webhookId);
    
    if (!webhook || !webhook.active) continue;
    if (!webhook.events.includes(eventType)) continue;

    // Create event
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    // Queue async delivery with retries
    deliverWebhookWithRetry(webhook, event).catch(error => {
      console.error(`Webhook delivery failed for ${webhookId}:`, error);
    });
  }
}

/**
 * Deliver webhook with retry logic
 */
async function deliverWebhookWithRetry(
  webhook: WebhookSubscription,
  event: WebhookEvent
): Promise<void> {
  // We don't store plaintext secrets, so we need a different approach
  // In production, use a secure secret store or pass through encrypted
  
  // For now, we'll skip delivery if we don't have the secret
  // This is a limitation of the in-memory implementation
  console.log(`📤 Would deliver webhook ${event.id} (${event.event}) to ${webhook.target_url}`);
  
  // Log the delivery attempt
  const delivery: WebhookDelivery = {
    id: crypto.randomUUID(),
    subscription_id: webhook.id,
    event_id: event.id,
    status: 'pending',
    attempt: 1,
    created_at: new Date().toISOString(),
  };

  if (!webhookDeliveries.has(webhook.id)) {
    webhookDeliveries.set(webhook.id, []);
  }
  
  const deliveries = webhookDeliveries.get(webhook.id)!;
  deliveries.push(delivery);

  // Keep only last 100 deliveries
  if (deliveries.length > 100) {
    deliveries.shift();
  }

  // Update last triggered
  webhook.last_triggered_at = new Date().toISOString();
}

/**
 * Convenience functions for common events
 */
export const WebhookEvents = {
  handleClaimed: (publicKey: string, handle: string) => 
    dispatchWebhookEvent(publicKey, 'handle.claimed', { handle }),

  messageReceived: (publicKey: string, messageId: string, fromPk: string, fromHandle?: string) =>
    dispatchWebhookEvent(publicKey, 'message.received', { 
      message_id: messageId, 
      from_pk: fromPk,
      from_handle: fromHandle,
    }),

  paymentReceived: (publicKey: string, paymentId: string, amount: string, currency: string, fromPk: string) =>
    dispatchWebhookEvent(publicKey, 'payment.received', {
      payment_id: paymentId,
      amount,
      currency,
      from_pk: fromPk,
    }),

  paymentRequestCreated: (publicKey: string, paymentId: string, amount: string, currency: string) =>
    dispatchWebhookEvent(publicKey, 'payment.request.created', {
      payment_id: paymentId,
      amount,
      currency,
    }),

  paymentRequestCompleted: (publicKey: string, paymentId: string, fromPk: string, txHash?: string) =>
    dispatchWebhookEvent(publicKey, 'payment.request.completed', {
      payment_id: paymentId,
      from_pk: fromPk,
      stellar_tx_hash: txHash,
    }),

  trustThresholdReached: (publicKey: string, level: string, trustScore: number, breadcrumbs: number) =>
    dispatchWebhookEvent(publicKey, 'trust.threshold.reached', {
      level,
      trust_score: trustScore,
      breadcrumb_count: breadcrumbs,
    }),

  gsiteUpdated: (publicKey: string, handle: string) =>
    dispatchWebhookEvent(publicKey, 'gsite.updated', { handle }),
};
