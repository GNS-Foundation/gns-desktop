// ===========================================
// GNS NODE - SPRINT 8 API ROUTES
// Multi-Currency, Webhooks, Payment Links, Invoices, QR Codes
//
// Location: src/api/sprint8.ts
// ===========================================

import { Router, Request, Response } from 'express';
import { isValidPublicKey } from '../lib/crypto';
import * as db from '../lib/db';
import { ApiResponse } from '../types';
import crypto from 'crypto';

const router = Router();

// ===========================================
// AUTH MIDDLEWARE
// ===========================================

interface AuthenticatedRequest extends Request {
  gnsPublicKey?: string;
  merchantId?: string;
}

const verifyGnsAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: Function
) => {
  const publicKey = (req.headers['x-gns-public-key'] as string)?.toLowerCase();
  if (!publicKey || !isValidPublicKey(publicKey)) {
    return res.status(401).json({ success: false, error: 'Invalid public key' });
  }
  req.gnsPublicKey = publicKey;
  next();
};

const verifyMerchantAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: Function
) => {
  const apiKey = req.headers['x-gns-merchant-key'] as string;
  if (!apiKey) {
    return res.status(401).json({ success: false, error: 'Missing merchant API key' });
  }
  const merchant = await db.getMerchantByApiKey(apiKey);
  if (!merchant) {
    return res.status(401).json({ success: false, error: 'Invalid API key' });
  }
  req.merchantId = merchant.merchant_id;
  next();
};

// ===========================================
// ASSET REGISTRY ENDPOINTS
// ===========================================

/**
 * GET /assets/registry
 * Get supported assets
 */
router.get('/assets/registry', async (req: Request, res: Response) => {
  try {
    const assets = await db.getSupportedAssets();
    res.json({ success: true, data: assets });
  } catch (error) {
    console.error('GET /assets/registry error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /currency/preferences
 * Get user currency preferences
 */
router.get('/currency/preferences', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const prefs = await db.getCurrencyPreferences(userPk);

    res.json({
      success: true,
      data: prefs || {
        default_currency: 'USDC',
        display_currency: 'USD',
        favorite_assets: ['USDC', 'XLM', 'GNS'],
        show_small_balances: true,
        small_balance_threshold: 0.01,
      },
    });
  } catch (error) {
    console.error('GET /currency/preferences error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /currency/preferences
 * Update currency preferences
 */
router.put('/currency/preferences', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const prefs = await db.upsertCurrencyPreferences(userPk, req.body);

    res.json({ success: true, data: prefs, message: 'Preferences updated' });
  } catch (error) {
    console.error('PUT /currency/preferences error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /exchange/rate
 * Get exchange rate between two assets
 */
router.get('/exchange/rate', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: 'Missing from and/or to parameters',
      });
    }

    const rate = await db.getExchangeRate(from as string, to as string);

    if (!rate) {
      return res.status(404).json({
        success: false,
        error: 'Exchange rate not available',
      });
    }

    res.json({ success: true, data: rate });
  } catch (error) {
    console.error('GET /exchange/rate error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /exchange/rates
 * Get all exchange rates
 */
router.get('/exchange/rates', async (req: Request, res: Response) => {
  try {
    const rates = await db.getAllExchangeRates();
    res.json({ success: true, data: rates });
  } catch (error) {
    console.error('GET /exchange/rates error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================
// WEBHOOK ENDPOINTS
// ===========================================

/**
 * GET /webhooks/endpoints
 * Get merchant webhook endpoints
 */
router.get('/webhooks/endpoints', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const endpoints = await db.getWebhookEndpoints(merchantId);

    res.json({ success: true, data: endpoints });
  } catch (error) {
    console.error('GET /webhooks/endpoints error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /webhooks/endpoints
 * Create webhook endpoint
 */
router.post('/webhooks/endpoints', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const { url, description, events } = req.body;

    if (!url || !events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: url, events[]',
      });
    }

    // Generate secret
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const endpoint = await db.createWebhookEndpoint({
      merchant_id: merchantId,
      url,
      description,
      events,
      secret,
    });

    console.log(`🪝 Webhook endpoint created: ${merchantId} -> ${url}`);

    res.status(201).json({ success: true, data: endpoint });
  } catch (error) {
    console.error('POST /webhooks/endpoints error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /webhooks/endpoints/:endpointId
 * Update webhook endpoint
 */
router.put('/webhooks/endpoints/:endpointId', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { endpointId } = req.params;
    const merchantId = req.merchantId!;

    const endpoint = await db.updateWebhookEndpoint(endpointId, merchantId, req.body);

    if (!endpoint) {
      return res.status(404).json({ success: false, error: 'Endpoint not found' });
    }

    res.json({ success: true, data: endpoint });
  } catch (error) {
    console.error('PUT /webhooks/endpoints error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /webhooks/endpoints/:endpointId
 * Delete webhook endpoint
 */
router.delete('/webhooks/endpoints/:endpointId', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { endpointId } = req.params;
    const merchantId = req.merchantId!;

    await db.deleteWebhookEndpoint(endpointId, merchantId);

    res.json({ success: true, message: 'Endpoint deleted' });
  } catch (error) {
    console.error('DELETE /webhooks/endpoints error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /webhooks/endpoints/:endpointId/test
 * Test webhook endpoint
 */
router.post('/webhooks/endpoints/:endpointId/test', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { endpointId } = req.params;
    const merchantId = req.merchantId!;

    const result = await db.testWebhookEndpoint(endpointId, merchantId);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('POST /webhooks/endpoints/:id/test error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /webhooks/events
 * Get webhook events
 */
router.get('/webhooks/events', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const { type, limit = '50', offset = '0' } = req.query;

    const events = await db.getWebhookEvents(merchantId, {
      type: type as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    } as any);

    res.json({ success: true, data: events });
  } catch (error) {
    console.error('GET /webhooks/events error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /webhooks/deliveries
 * Get webhook deliveries
 */
router.get('/webhooks/deliveries', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const { event_id, endpoint_id, status, limit = '50' } = req.query;

    const deliveries = await db.getWebhookDeliveries(merchantId, {
      eventId: event_id as string,
      endpointId: endpoint_id as string,
      status: status as string,
      limit: parseInt(limit as string),
    } as any);

    res.json({ success: true, data: deliveries });
  } catch (error) {
    console.error('GET /webhooks/deliveries error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================
// PAYMENT LINK ENDPOINTS
// ===========================================

/**
 * POST /payment-links
 * Create payment link
 */
router.post('/payment-links', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const {
      type = 'oneTime',
      fixed_amount,
      min_amount,
      max_amount,
      currency = 'USDC',
      title,
      description,
      expires_in_seconds,
      max_payments,
      collect_email,
      collect_phone,
      metadata,
    } = req.body;

    // Generate short code
    const shortCode = crypto.randomBytes(4).toString('hex');

    const link = await db.createPaymentLink({
      merchant_id: merchantId,
      short_code: shortCode,
      type,
      fixed_amount,
      min_amount,
      max_amount,
      currency,
      title,
      description,
      expires_at: expires_in_seconds
        ? new Date(Date.now() + expires_in_seconds * 1000).toISOString()
        : null,
      max_payments,
      collect_email,
      collect_phone,
      metadata,
    });

    console.log(`🔗 Payment link created: ${shortCode}`);

    res.status(201).json({ success: true, data: link });
  } catch (error) {
    console.error('POST /payment-links error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /payment-links
 * Get merchant's payment links
 */
router.get('/payment-links', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const { status, limit = '50', offset = '0' } = req.query;

    const links = await db.getPaymentLinks(merchantId, {
      status: status as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({ success: true, data: links });
  } catch (error) {
    console.error('GET /payment-links error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /payment-links/:linkId
 * Get payment link details
 */
router.get('/payment-links/:linkId', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { linkId } = req.params;
    const merchantId = req.merchantId!;

    const link = await db.getPaymentLink(linkId);

    if (!link || link.merchant_id !== merchantId) {
      return res.status(404).json({ success: false, error: 'Link not found' });
    }

    res.json({ success: true, data: link });
  } catch (error) {
    console.error('GET /payment-links/:id error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /pay/:shortCode
 * Get payment link by short code (public)
 */
router.get('/pay/:shortCode', async (req: Request, res: Response) => {
  try {
    const { shortCode } = req.params;

    const link = await db.getPaymentLinkByCode(shortCode);

    if (!link) {
      return res.status(404).json({ success: false, error: 'Link not found' });
    }

    // Increment view count
    await db.incrementLinkViews(link.link_id);

    res.json({ success: true, data: link });
  } catch (error) {
    console.error('GET /pay/:shortCode error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /pay/:shortCode
 * Pay via payment link
 */
router.post('/pay/:shortCode', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { shortCode } = req.params;
    const userPk = req.gnsPublicKey!;
    const { amount, email, phone } = req.body;

    const link = await db.getPaymentLinkByCode(shortCode);

    if (!link) {
      return res.status(404).json({ success: false, error: 'Link not found' });
    }

    // Validate link is active
    if (link.status !== 'active') {
      return res.status(400).json({ success: false, error: 'Link is not active' });
    }

    // Validate amount
    const payAmount = link.fixed_amount || amount;
    if (!payAmount) {
      return res.status(400).json({ success: false, error: 'Amount required' });
    }

    // Create payment record
    const payment = await db.createLinkPayment({
      link_id: link.link_id,
      payer_public_key: userPk,
      amount: payAmount,
      currency: link.currency,
      payer_email: email,
      payer_phone: phone,
    });

    // Update link stats
    await db.updateLinkStats(link.link_id, payAmount);

    // For one-time links, mark as completed
    if (link.type === 'oneTime') {
      await db.updatePaymentLinkStatus(link.link_id, 'completed');
    }

    console.log(`💳 Payment via link: ${shortCode} - $${payAmount}`);

    res.json({
      success: true,
      data: {
        payment_id: payment.payment_id,
        stellar_tx_hash: payment.stellar_tx_hash,
      },
    });
  } catch (error) {
    console.error('POST /pay/:shortCode error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================
// INVOICE ENDPOINTS
// ===========================================

/**
 * POST /invoices
 * Create invoice
 */
router.post('/invoices', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const {
      customer_public_key,
      customer_handle,
      customer_name,
      customer_email,
      line_items,
      currency = 'USDC',
      due_days = 30,
      notes,
      terms,
      send_email,
      create_payment_link,
    } = req.body;

    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one line item required',
      });
    }

    // Calculate totals
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (const item of line_items) {
      const itemSubtotal = item.quantity * item.unit_price;
      const discount = item.discount_percent ? itemSubtotal * (item.discount_percent / 100) : 0;
      const tax = item.tax_rate ? (itemSubtotal - discount) * (item.tax_rate / 100) : 0;

      subtotal += itemSubtotal;
      totalDiscount += discount;
      totalTax += tax;
    }

    const total = subtotal - totalDiscount + totalTax;

    const invoice = await db.createInvoice({
      merchant_id: merchantId,
      customer_public_key,
      customer_handle,
      customer_name,
      customer_email,
      line_items,
      subtotal,
      total_discount: totalDiscount,
      total_tax: totalTax,
      total,
      amount: total,
      currency,
      due_days,
      notes,
      terms,
    });

    // Create payment link if requested
    if (create_payment_link) {
      const linkCode = crypto.randomBytes(4).toString('hex');
      await db.createPaymentLink({
        merchant_id: merchantId,
        short_code: linkCode,
        type: 'oneTime',
        fixed_amount: total,
        currency,
        title: `Invoice ${invoice.invoice_number}`,
        metadata: { invoice_id: invoice.invoice_id },
      });
    }

    // Send email if requested
    if (send_email && customer_email) {
      // TODO: Implement email sending
      console.log(`📧 Would send invoice to ${customer_email}`);
    }

    console.log(`📄 Invoice created: ${invoice.invoice_number}`);

    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    console.error('POST /invoices error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /invoices
 * Get merchant invoices
 */
router.get('/invoices', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const { status, limit = '50', offset = '0' } = req.query;

    const invoices = await db.getInvoices(merchantId, {
      status: status as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({ success: true, data: invoices });
  } catch (error) {
    console.error('GET /invoices error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /invoices/:invoiceId
 * Get invoice details
 */
router.get('/invoices/:invoiceId', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const merchantId = req.merchantId!;

    const invoice = await db.getInvoice(invoiceId);

    if (!invoice || invoice.merchant_id !== merchantId) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error('GET /invoices/:id error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /invoices/:invoiceId/send
 * Send invoice to customer
 */
router.post('/invoices/:invoiceId/send', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const merchantId = req.merchantId!;
    const { email } = req.body;

    const invoice = await db.getInvoice(invoiceId);

    if (!invoice || invoice.merchant_id !== merchantId) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Update status to sent
    await db.updateInvoiceStatus(invoiceId, 'sent');

    // TODO: Send email
    console.log(`📧 Invoice ${invoice.invoice_number} sent`);

    res.json({ success: true, message: 'Invoice sent' });
  } catch (error) {
    console.error('POST /invoices/:id/send error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /invoices/:invoiceId/mark-paid
 * Mark invoice as paid
 */
router.post('/invoices/:invoiceId/mark-paid', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const merchantId = req.merchantId!;
    const { transaction_hash, notes } = req.body;

    const invoice = await db.markInvoicePaid(invoiceId, merchantId, {
      transaction_hash,
      notes,
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error('POST /invoices/:id/mark-paid error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /invoices/:invoiceId/pdf
 * Download invoice PDF
 */
router.get('/invoices/:invoiceId/pdf', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await db.getInvoice(invoiceId);

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // TODO: Generate actual PDF
    // For now, return placeholder
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoice_number}.pdf"`);
    res.send(Buffer.from('PDF content would go here'));
  } catch (error) {
    console.error('GET /invoices/:id/pdf error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================
// QR CODE ENDPOINTS
// ===========================================

/**
 * POST /qr/generate
 * Generate QR code for user
 */
router.post('/qr/generate', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const {
      type = 'dynamicPayment',
      amount,
      currency = 'USDC',
      memo,
      reference,
      expires_in_seconds,
      single_use,
    } = req.body;

    // Generate QR data
    const qrData = `gns://pay?to=${userPk}&currency=${currency}${amount ? `&amount=${amount}` : ''}${memo ? `&memo=${encodeURIComponent(memo)}` : ''}`;

    const qr = await db.createQrCode({
      user_pk: userPk,
      type,
      data: qrData,
      amount,
      currency,
      memo,
      reference,
      expires_at: expires_in_seconds
        ? new Date(Date.now() + expires_in_seconds * 1000).toISOString()
        : undefined,
      single_use,
    });

    res.status(201).json({ success: true, data: qr });
  } catch (error) {
    console.error('POST /qr/generate error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /qr/merchant
 * Generate static merchant QR
 */
router.post('/qr/merchant', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const { currency = 'USDC', default_memo } = req.body;

    const merchant = await db.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Merchant not found' });
    }

    const qrData = `gns://pay?merchant=${merchantId}&currency=${currency}${default_memo ? `&memo=${encodeURIComponent(default_memo)}` : ''}`;

    const qr = await db.createQrCode({
      merchant_id: merchantId,
      type: 'staticMerchant',
      data: qrData,
      currency,
      memo: default_memo,
    });

    res.status(201).json({ success: true, data: qr });
  } catch (error) {
    console.error('POST /qr/merchant error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /qr/:qrId
 * Get QR code details
 */
router.get('/qr/:qrId', async (req: Request, res: Response) => {
  try {
    const { qrId } = req.params;

    const qr = await db.getQrCode(qrId);

    if (!qr) {
      return res.status(404).json({ success: false, error: 'QR code not found' });
    }

    res.json({ success: true, data: qr });
  } catch (error) {
    console.error('GET /qr/:qrId error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /qr/user/list
 * Get user's QR codes
 */
router.get('/qr/user/list', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;

    const qrCodes = await db.getUserQrCodes(userPk);

    res.json({ success: true, data: qrCodes });
  } catch (error) {
    console.error('GET /qr/user/list error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /qr/:qrId
 * Deactivate QR code
 */
router.delete('/qr/:qrId', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { qrId } = req.params;
    const userPk = req.gnsPublicKey!;

    await db.deactivateQrCode(qrId, userPk);

    res.json({ success: true, message: 'QR code deactivated' });
  } catch (error) {
    console.error('DELETE /qr/:qrId error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
