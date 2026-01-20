// ===========================================
// GNS API - PAYMENTS
// /v1/payments/* endpoints
// ===========================================
//
// Stripe-like payment request flow:
// 1. Merchant creates payment request
// 2. Customer scans QR / clicks deep link
// 3. Customer approves in GNS app
// 4. Payment executes on Stellar
// 5. Merchant receives webhook notification
//
// Supports:
// - GNS token payments
// - XLM payments
// - Payment requests with QR codes
// - Deep links for mobile
// - Webhook callbacks
// ===========================================

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import * as db from '../lib/db';
import {
  verifySignature,
  isValidPublicKey,
  canonicalJson,
} from '../lib/crypto';
import {
  ApiResponse,
  PaymentRequest,
  PaymentResponse,
  PaymentStatus,
  PaymentCurrency,
  DbPaymentRequest,
  Balance,
  AuthenticatedRequest,
} from '../types/api.types';
import { WebhookEvents } from './webhooks';

const router = Router();

// ===========================================
// CONFIGURATION
// ===========================================

const CONFIG = {
  baseUrl: process.env.API_BASE_URL || 'https://api.gns.network',
  webUrl: process.env.WEB_URL || 'https://gns.network',
  defaultExpiresIn: 3600, // 1 hour
  maxExpiresIn: 86400,    // 24 hours
  minAmount: '0.0000001', // Stellar minimum
  gnsTokenCode: 'GNS',
  gnsIssuer: process.env.GNS_ISSUER || 'GBVZTFST4PIPV5C3APDIVULNZYZENQSLGDSOKOVQI77GSMT6WVYGF5GL',
};

// ===========================================
// IN-MEMORY PAYMENT REQUEST STORE
// In production, persist to database
// ===========================================

const paymentRequests = new Map<string, DbPaymentRequest>();

// Cleanup expired requests every 5 minutes
setInterval(() => {
  const now = new Date().toISOString();
  for (const [id, request] of paymentRequests.entries()) {
    if (request.status === 'pending' && request.expires_at < now) {
      request.status = 'expired';

      // Trigger webhook
      WebhookEvents.paymentRequestCompleted(request.creator_pk, request.payment_id, '', undefined);
    }
  }
}, 5 * 60 * 1000);

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Generate unique payment ID
 */
function generatePaymentId(): string {
  return `pay_${crypto.randomBytes(12).toString('base64url')}`;
}

/**
 * Validate amount string
 */
function isValidAmount(amount: string): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num >= parseFloat(CONFIG.minAmount);
}

/**
 * Resolve identifier to public key
 */
async function resolveToPublicKey(identifier: string): Promise<{
  publicKey: string;
  handle?: string;
} | null> {
  if (identifier.startsWith('@') || !identifier.match(/^[a-f0-9]{64}$/i)) {
    // It's a handle
    const handle = identifier.toLowerCase().replace(/^@/, '');
    const publicKey = await db.resolveHandleToPublicKey(handle);
    if (!publicKey) return null;
    return { publicKey, handle };
  } else {
    // It's a public key
    const publicKey = identifier.toLowerCase();
    if (!isValidPublicKey(publicKey)) return null;

    const alias = await db.getAliasByPk(publicKey);
    return { publicKey, handle: alias?.handle };
  }
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
    const path = req.originalUrl;
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
// POST /payments/request
// Create payment request
// ===========================================

router.post('/request', authenticateGns, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const creatorPk = req.gnsPublicKey!;
    const body = req.body as PaymentRequest;

    // Validate recipient
    if (!body.to) {
      return res.status(400).json({
        success: false,
        error: 'to is required (handle or public key)',
        code: 'INVALID_INPUT',
      } as ApiResponse);
    }

    const recipient = await resolveToPublicKey(body.to);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        error: 'Recipient not found',
        code: 'RECIPIENT_NOT_FOUND',
      } as ApiResponse);
    }

    // Validate amount
    if (!body.amount || !isValidAmount(body.amount)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
        code: 'INVALID_AMOUNT',
      } as ApiResponse);
    }

    // Validate currency
    const validCurrencies: PaymentCurrency[] = ['GNS', 'XLM', 'USDC', 'EUR', 'BTC'];
    if (!body.currency || !validCurrencies.includes(body.currency)) {
      return res.status(400).json({
        success: false,
        error: `Invalid currency. Supported: ${validCurrencies.join(', ')}`,
        code: 'INVALID_CURRENCY',
      } as ApiResponse);
    }

    // Currently only support GNS and XLM
    if (!['GNS', 'XLM'].includes(body.currency)) {
      return res.status(400).json({
        success: false,
        error: `Currency ${body.currency} not yet supported. Use GNS or XLM.`,
        code: 'CURRENCY_NOT_SUPPORTED',
      } as ApiResponse);
    }

    // Validate callback URL if provided
    if (body.callback_url) {
      try {
        const url = new URL(body.callback_url);
        if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
          return res.status(400).json({
            success: false,
            error: 'callback_url must use HTTPS',
            code: 'INVALID_CALLBACK_URL',
          } as ApiResponse);
        }
      } catch {
        return res.status(400).json({
          success: false,
          error: 'Invalid callback_url',
          code: 'INVALID_CALLBACK_URL',
        } as ApiResponse);
      }
    }

    // Calculate expiration
    const expiresIn = Math.min(
      body.expires_in || CONFIG.defaultExpiresIn,
      CONFIG.maxExpiresIn
    );
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Generate payment ID
    const paymentId = generatePaymentId();
    const now = new Date().toISOString();

    // Create payment request
    const paymentRequest: DbPaymentRequest = {
      id: crypto.randomUUID(),
      payment_id: paymentId,
      creator_pk: creatorPk,
      to_pk: recipient.publicKey,
      to_handle: recipient.handle,
      amount: body.amount,
      currency: body.currency,
      memo: body.memo,
      reference_id: body.reference_id,
      callback_url: body.callback_url,
      status: 'pending',
      created_at: now,
      expires_at: expiresAt,
    };

    // Store
    paymentRequests.set(paymentId, paymentRequest);

    // Store in database
    if (db.createPaymentRequest) {
      await db.createPaymentRequest(paymentRequest);
    }

    console.log(`💰 Payment request created: ${paymentId}`);
    console.log(`   To: ${recipient.handle ? '@' + recipient.handle : recipient.publicKey.substring(0, 16) + '...'}`);
    console.log(`   Amount: ${body.amount} ${body.currency}`);

    // Trigger webhook
    WebhookEvents.paymentRequestCreated(
      recipient.publicKey,
      paymentId,
      body.amount,
      body.currency
    );

    // Build response
    const response: PaymentResponse = {
      payment_id: paymentId,
      status: 'pending',
      to_pk: recipient.publicKey,
      to_handle: recipient.handle ? `@${recipient.handle}` : undefined,
      amount: body.amount,
      currency: body.currency,
      memo: body.memo,
      reference_id: body.reference_id,
      qr_url: `${CONFIG.baseUrl}/v1/payments/${paymentId}/qr`,
      deep_link: `gns://pay/${paymentId}`,
      web_url: `${CONFIG.webUrl}/pay/${paymentId}`,
      created_at: now,
      expires_at: expiresAt,
    };

    return res.status(201).json({
      success: true,
      data: response,
    } as ApiResponse<PaymentResponse>);

  } catch (error) {
    console.error('Create payment request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// GET /payments/:paymentId
// Get payment request status
// ===========================================

router.get('/:paymentId', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    const payment = paymentRequests.get(paymentId);

    if (!payment) {
      // Try database
      if (db.getPaymentRequest) {
        const dbPayment = await db.getPaymentRequest(paymentId);
        if (dbPayment) {
          paymentRequests.set(paymentId, dbPayment);
        }
      }
    }

    const request = paymentRequests.get(paymentId);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Payment request not found',
        code: 'NOT_FOUND',
      } as ApiResponse);
    }

    // Check if expired
    if (request.status === 'pending' && request.expires_at < new Date().toISOString()) {
      request.status = 'expired';
    }

    // Get payer info if completed
    let fromHandle: string | undefined;
    if (request.from_pk) {
      const alias = await db.getAliasByPk(request.from_pk);
      fromHandle = alias?.handle;
    }

    const response: PaymentResponse = {
      payment_id: request.payment_id,
      status: request.status as PaymentStatus,
      from_pk: request.from_pk,
      from_handle: fromHandle ? `@${fromHandle}` : undefined,
      to_pk: request.to_pk || '', // Should ensure this is valid but for now default to empty if undefined
      to_handle: request.to_handle ? `@${request.to_handle}` : undefined,
      amount: request.amount,
      currency: request.currency as PaymentCurrency,
      memo: request.memo,
      reference_id: request.reference_id,
      qr_url: `${CONFIG.baseUrl}/v1/payments/${request.payment_id}/qr`,
      deep_link: `gns://pay/${request.payment_id}`,
      web_url: `${CONFIG.webUrl}/pay/${request.payment_id}`,
      stellar_tx_hash: request.stellar_tx_hash,
      created_at: request.created_at,
      expires_at: request.expires_at,
      completed_at: request.completed_at,
    };

    return res.json({
      success: true,
      data: response,
    } as ApiResponse<PaymentResponse>);

  } catch (error) {
    console.error('Get payment request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// GET /payments/:paymentId/qr
// Generate QR code for payment
// ===========================================

router.get('/:paymentId/qr', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const size = Math.min(Math.max(parseInt(req.query.size as string) || 256, 64), 1024);

    const request = paymentRequests.get(paymentId);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Payment request not found',
        code: 'NOT_FOUND',
      } as ApiResponse);
    }

    // Generate deep link for QR
    const deepLink = `gns://pay/${paymentId}`;

    // Generate QR code
    const qrBuffer = await QRCode.toBuffer(deepLink, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache 5 minutes
    return res.send(qrBuffer);

  } catch (error) {
    console.error('Generate QR error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate QR code',
      code: 'QR_GENERATION_FAILED',
    } as ApiResponse);
  }
});

// ===========================================
// POST /payments/:paymentId/pay
// Pay a payment request (called by GNS app)
// ===========================================

router.post('/:paymentId/pay', authenticateGns, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { paymentId } = req.params;
    const payerPk = req.gnsPublicKey!;
    const { stellar_tx_hash, signature } = req.body;

    const request = paymentRequests.get(paymentId);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Payment request not found',
        code: 'NOT_FOUND',
      } as ApiResponse);
    }

    // Check status
    if (request.status !== 'pending') {
      return res.status(409).json({
        success: false,
        error: `Payment is already ${request.status}`,
        code: 'INVALID_STATUS',
      } as ApiResponse);
    }

    // Check expiration
    if (request.expires_at < new Date().toISOString()) {
      request.status = 'expired';
      return res.status(410).json({
        success: false,
        error: 'Payment request has expired',
        code: 'EXPIRED',
      } as ApiResponse);
    }

    // Verify payment signature
    const paymentData = canonicalJson({
      action: 'pay',
      payment_id: paymentId,
      payer_pk: payerPk,
      amount: request.amount,
      currency: request.currency,
      stellar_tx_hash,
    });

    if (signature && !verifySignature(payerPk, paymentData, signature)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid payment signature',
        code: 'INVALID_SIGNATURE',
      } as ApiResponse);
    }

    // TODO: Verify Stellar transaction
    // In production, verify the transaction on Stellar:
    // 1. Fetch transaction by hash
    // 2. Verify amount matches
    // 3. Verify destination matches to_pk's Stellar address
    // 4. Verify asset matches (XLM or GNS token)

    // Update payment status
    request.status = 'completed';
    request.from_pk = payerPk;
    request.stellar_tx_hash = stellar_tx_hash;
    request.completed_at = new Date().toISOString();

    // Update in database
    if (db.updatePaymentRequest) {
      await db.updatePaymentRequest(paymentId, {
        status: 'completed',
        from_pk: payerPk,
        stellar_tx_hash,
        completed_at: request.completed_at,
      });
    }

    console.log(`✅ Payment completed: ${paymentId}`);
    console.log(`   From: ${payerPk.substring(0, 16)}...`);
    console.log(`   Amount: ${request.amount} ${request.currency}`);
    console.log(`   Tx: ${stellar_tx_hash}`);

    // Trigger webhooks
    WebhookEvents.paymentReceived(
      request.to_pk || '',
      paymentId,
      request.amount,
      request.currency,
      payerPk
    );

    WebhookEvents.paymentRequestCompleted(
      request.creator_pk,
      paymentId,
      payerPk,
      stellar_tx_hash
    );

    // Send callback if configured
    if (request.callback_url) {
      sendCallback(request.callback_url, {
        payment_id: paymentId,
        status: 'completed',
        from_pk: payerPk,
        amount: request.amount,
        currency: request.currency,
        stellar_tx_hash,
        completed_at: request.completed_at,
      }).catch(error => {
        console.error(`Callback failed for ${paymentId}:`, error);
      });
    }

    // Get payer handle
    const payerAlias = await db.getAliasByPk(payerPk);

    const response: PaymentResponse = {
      payment_id: paymentId,
      status: 'completed',
      from_pk: payerPk,
      from_handle: payerAlias?.handle ? `@${payerAlias.handle}` : undefined,
      to_pk: request.to_pk || '',
      to_handle: request.to_handle ? `@${request.to_handle}` : undefined,
      amount: request.amount,
      currency: request.currency as PaymentCurrency,
      memo: request.memo,
      stellar_tx_hash,
      qr_url: `${CONFIG.baseUrl}/v1/payments/${paymentId}/qr`,
      deep_link: `gns://pay/${paymentId}`,
      web_url: `${CONFIG.webUrl}/pay/${paymentId}`,
      created_at: request.created_at,
      expires_at: request.expires_at,
      completed_at: request.completed_at,
    };

    return res.json({
      success: true,
      data: response,
    } as ApiResponse<PaymentResponse>);

  } catch (error) {
    console.error('Pay request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// POST /payments/:paymentId/cancel
// Cancel a pending payment request
// ===========================================

router.post('/:paymentId/cancel', authenticateGns, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { paymentId } = req.params;
    const publicKey = req.gnsPublicKey!;

    const request = paymentRequests.get(paymentId);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Payment request not found',
        code: 'NOT_FOUND',
      } as ApiResponse);
    }

    // Only creator can cancel
    if (request.creator_pk !== publicKey) {
      return res.status(403).json({
        success: false,
        error: 'Only the creator can cancel this payment request',
        code: 'FORBIDDEN',
      } as ApiResponse);
    }

    // Can only cancel pending requests
    if (request.status !== 'pending') {
      return res.status(409).json({
        success: false,
        error: `Cannot cancel ${request.status} payment`,
        code: 'INVALID_STATUS',
      } as ApiResponse);
    }

    // Update status
    request.status = 'cancelled';

    // Update in database
    if (db.updatePaymentRequest) {
      await db.updatePaymentRequest(paymentId, { status: 'cancelled' });
    }

    console.log(`🚫 Payment cancelled: ${paymentId}`);

    return res.json({
      success: true,
      data: { payment_id: paymentId, status: 'cancelled' },
    } as ApiResponse);

  } catch (error) {
    console.error('Cancel payment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// POST /payments/send
// Direct payment (not a request)
// ===========================================

router.post('/send', authenticateGns, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const senderPk = req.gnsPublicKey!;
    const { to, amount, currency, memo, stellar_tx_hash, signature } = req.body;

    // Validate recipient
    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'to is required',
        code: 'INVALID_INPUT',
      } as ApiResponse);
    }

    const recipient = await resolveToPublicKey(to);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        error: 'Recipient not found',
        code: 'RECIPIENT_NOT_FOUND',
      } as ApiResponse);
    }

    // Validate amount
    if (!amount || !isValidAmount(amount)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
        code: 'INVALID_AMOUNT',
      } as ApiResponse);
    }

    // Validate currency
    if (!['GNS', 'XLM'].includes(currency)) {
      return res.status(400).json({
        success: false,
        error: 'Currency must be GNS or XLM',
        code: 'INVALID_CURRENCY',
      } as ApiResponse);
    }

    // Verify signature
    const paymentData = canonicalJson({
      action: 'send',
      from_pk: senderPk,
      to_pk: recipient.publicKey,
      amount,
      currency,
      stellar_tx_hash,
    });

    if (signature && !verifySignature(senderPk, paymentData, signature)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE',
      } as ApiResponse);
    }

    // TODO: Verify Stellar transaction
    // Same verification as /pay endpoint

    console.log(`💸 Direct payment: ${senderPk.substring(0, 16)}... -> ${recipient.handle || recipient.publicKey.substring(0, 16)}...`);
    console.log(`   Amount: ${amount} ${currency}`);
    console.log(`   Tx: ${stellar_tx_hash}`);

    // Trigger webhook for recipient
    WebhookEvents.paymentReceived(
      recipient.publicKey,
      stellar_tx_hash || 'direct',
      amount,
      currency,
      senderPk
    );

    // Get sender handle
    const senderAlias = await db.getAliasByPk(senderPk);

    return res.json({
      success: true,
      data: {
        tx_hash: stellar_tx_hash,
        from_pk: senderPk,
        from_handle: senderAlias?.handle ? `@${senderAlias.handle}` : undefined,
        to_pk: recipient.publicKey,
        to_handle: recipient.handle ? `@${recipient.handle}` : undefined,
        amount,
        currency,
        memo,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Send payment error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// GET /payments/balance
// Get token balances for authenticated user
// ===========================================

router.get('/balance', authenticateGns, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;

    // In production, query Stellar Horizon for actual balances
    // For now, return placeholder

    // TODO: Integrate with stellar_service.ts
    // const balances = await stellarService.getBalances(publicKey);

    const balances: Balance[] = [
      {
        asset_code: 'XLM',
        balance: '0.0000000',
        is_native: true,
      },
      {
        asset_code: 'GNS',
        asset_issuer: CONFIG.gnsIssuer,
        balance: '0.0000000',
        is_native: false,
      },
    ];

    return res.json({
      success: true,
      data: {
        public_key: publicKey,
        balances,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Get balance error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// HELPER: Send callback notification
// ===========================================

async function sendCallback(
  url: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GNS-Payments/1.0',
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`Callback returned ${response.status}: ${url}`);
    }
  } catch (error) {
    console.error(`Callback failed: ${url}`, error);
    throw error;
  }
}

export default router;
