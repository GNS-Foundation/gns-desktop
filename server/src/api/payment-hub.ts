// ===========================================
// GNS NODE - SPRINT 8 PAYMENT HUB API
// Payment Links, Invoices, and QR Codes
//
// Location: src/api/payment-hub.ts
// Uses EXISTING db.ts functions with correct types
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
}

const verifyGnsAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: Function
) => {
  try {
    const publicKey = (req.headers['x-gns-publickey'] as string)?.toLowerCase();
    const identity = (req.headers['x-gns-identity'] as string)?.toLowerCase();
    const pk = publicKey || identity;

    if (!pk || !isValidPublicKey(pk)) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid X-GNS-PublicKey header',
      } as ApiResponse);
    }

    req.gnsPublicKey = pk;
    next();
  } catch (error) {
    console.error('Payment Hub auth error:', error);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function generateLinkCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function generateQRCode(): string {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

// ===========================================
// PAYMENT LINKS ENDPOINTS
// ===========================================

// GET /api/link/list - List user's payment links
router.get('/link/list', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const links = await db.getPaymentLinks(publicKey);

    return res.json({
      success: true,
      links: (links || []).map((link: any) => ({
        id: link.id,
        code: link.short_code || link.link_code || link.code,
        title: link.title,
        description: link.description,
        amount: link.amount || link.fixed_amount,
        currency: link.currency,
        type: link.type || (link.is_reusable ? 'reusable' : 'one_time'),
        status: link.status,
        url: `https://panthera.gcrumbs.com/pay/${link.short_code || link.link_code || link.code}`,
        paymentCount: link.payment_count || 0,
        totalReceived: link.total_collected || link.total_received || 0,
        expiresAt: link.expires_at,
        createdAt: link.created_at,
      })),
    } as ApiResponse);

  } catch (error) {
    console.error('GET /api/link/list error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/link/create - Create payment link
router.post('/link/create', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const body = req.body;
    const title = body.title || body.link_title || body.name;
    const description = body.description || body.memo;
    const amount = body.amount;
    const currency = body.currency || 'EUR';
    const type = body.type || 'one_time';
    const expiresAt = body.expiresAt || body.expires_at;

    if (!title || amount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Title and amount are required',
      });
    }

    const linkCode = generateLinkCode();

    // Match PaymentLinkInput type
    const link = await db.createPaymentLink({
      merchant_id: publicKey,
      owner_pk: publicKey,
      short_code: linkCode,
      title,
      description: description || undefined,
      amount: parseFloat(amount),
      currency,
      type,
      is_reusable: type === 'reusable',
      expires_at: expiresAt || null,
    });

    if (!link) {
      return res.status(500).json({ success: false, error: 'Failed to create link' });
    }

    return res.json({
      success: true,
      link: {
        id: link.id,
        code: link.short_code || link.link_code,
        title: link.title,
        description: link.description,
        amount: link.amount,
        currency: link.currency,
        type: link.type,
        status: link.status,
        url: `https://panthera.gcrumbs.com/pay/${link.short_code || link.link_code}`,
        createdAt: link.created_at,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('POST /api/link/create error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/link/:code - Get public link info (for PayPage)
router.get('/link/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const link = await db.getPaymentLinkByCode(code);

    if (!link) {
      return res.status(404).json({ success: false, error: 'Payment link not found' });
    }

    if (link.status !== 'active') {
      return res.status(410).json({ success: false, error: 'Payment link is no longer active' });
    }

    // Check expiration
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ success: false, error: 'Payment link has expired' });
    }

    // Get recipient handle
    const alias = await db.getAliasByPk(link.merchant_id);

    return res.json({
      success: true,
      link: {
        code: link.short_code || link.link_code || link.code,
        title: link.title,
        description: link.description,
        amount: link.amount || link.fixed_amount,
        currency: link.currency,
        type: link.type,
        recipientHandle: alias?.handle ? `@${alias.handle}` : null,
        recipientPk: link.merchant_id,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('GET /api/link/:code error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/link/:id/deactivate - Deactivate link
router.put('/link/:id/deactivate', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { id } = req.params;

    const link = await db.getPaymentLink(id);

    if (!link) {
      return res.status(404).json({ success: false, error: 'Payment link not found' });
    }

    if (link.merchant_id !== publicKey) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await db.updatePaymentLinkStatus(id, 'inactive');

    return res.json({ success: true, message: 'Payment link deactivated' } as ApiResponse);

  } catch (error) {
    console.error('PUT /api/link/:id/deactivate error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================
// INVOICES ENDPOINTS
// ===========================================

// GET /api/invoice/list - List user's invoices
router.get('/invoice/list', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const invoices = await db.getInvoices(publicKey);

    return res.json({
      success: true,
      invoices: (invoices || []).map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        customerName: inv.customer_name,
        customerEmail: inv.customer_email,
        customerHandle: inv.customer_handle,
        items: inv.items || inv.line_items,
        subtotal: inv.subtotal,
        tax: inv.total_tax || inv.tax_amount || inv.tax,
        total: inv.total || inv.amount,
        currency: inv.currency,
        status: inv.status,
        dueDate: inv.due_date,
        createdAt: inv.created_at,
        paidAt: inv.paid_at,
      })),
    } as ApiResponse);

  } catch (error) {
    console.error('GET /api/invoice/list error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/invoice/create - Create invoice
router.post('/invoice/create', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const body = req.body;

    // Support camelCase and snake_case
    const customerName = body.customerName || body.customer_name || body.name;
    const customerEmail = body.customerEmail || body.customer_email || body.email;
    const customerHandle = body.customerHandle || body.customer_handle || body.handle;
    const items = body.items || body.line_items;
    const currency = body.currency || 'EUR';
    const dueDate = body.dueDate || body.due_date;
    const notes = body.notes || body.memo;
    const taxRate = body.taxRate || body.tax_rate || 22; // Default Italian VAT

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Items are required' });
    }

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.amount || item.unit_price || 0) * (item.quantity || 1));
    }, 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    // Match InvoiceInput type
    const invoice = await db.createInvoice({
      merchant_id: publicKey,
      owner_pk: publicKey,
      customer_name: customerName || undefined,
      customer_email: customerEmail || undefined,
      customer_handle: customerHandle || undefined,
      items,
      subtotal,
      total_tax: tax,
      total,
      amount: total, // required field
      currency,
      due_date: dueDate || undefined,
      notes: notes || undefined,
    });

    if (!invoice) {
      return res.status(500).json({ success: false, error: 'Failed to create invoice' });
    }

    return res.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        customerName: invoice.customer_name,
        total: invoice.total || invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        createdAt: invoice.created_at,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('POST /api/invoice/create error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/invoice/:id - Get invoice details
router.get('/invoice/:id', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { id } = req.params;

    const invoice = await db.getInvoice(id);

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    if (invoice.merchant_id !== publicKey) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    return res.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        customerName: invoice.customer_name,
        customerEmail: invoice.customer_email,
        customerHandle: invoice.customer_handle,
        items: invoice.items || invoice.line_items,
        subtotal: invoice.subtotal,
        tax: invoice.total_tax || invoice.tax_amount || invoice.tax,
        total: invoice.total || invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.due_date,
        notes: invoice.notes,
        createdAt: invoice.created_at,
        sentAt: invoice.sent_at,
        paidAt: invoice.paid_at,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('GET /api/invoice/:id error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/invoice/:id/send - Mark invoice as sent
router.post('/invoice/:id/send', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { id } = req.params;

    const invoice = await db.getInvoice(id);

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    if (invoice.merchant_id !== publicKey) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await db.updateInvoiceStatus(id, 'sent');

    return res.json({ success: true, message: 'Invoice marked as sent' } as ApiResponse);

  } catch (error) {
    console.error('POST /api/invoice/:id/send error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/invoice/:id/paid - Mark invoice as paid
router.post('/invoice/:id/paid', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { id } = req.params;
    const { transactionId } = req.body;

    const invoice = await db.getInvoice(id);

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    if (invoice.merchant_id !== publicKey) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await db.markInvoicePaid(id, transactionId || publicKey);

    return res.json({ success: true, message: 'Invoice marked as paid' } as ApiResponse);

  } catch (error) {
    console.error('POST /api/invoice/:id/paid error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================
// QR CODES ENDPOINTS
// ===========================================

// GET /api/qr/list - List user's QR codes
router.get('/qr/list', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const qrCodes = await db.getUserQrCodes(publicKey);

    return res.json({
      success: true,
      qrCodes: (qrCodes || []).map((qr: any) => ({
        id: qr.id,
        code: qr.reference || qr.qr_code || qr.code,
        name: qr.memo || qr.name,
        description: qr.default_memo || qr.description,
        amount: qr.amount,
        currency: qr.currency,
        type: qr.type,
        status: qr.is_active ? 'active' : 'inactive',
        qrData: qr.data,
        scanCount: qr.scan_count || 0,
        createdAt: qr.created_at,
      })),
    } as ApiResponse);

  } catch (error) {
    console.error('GET /api/qr/list error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/qr/create - Create QR code
router.post('/qr/create', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const body = req.body;

    const name = body.name || body.memo || body.title;
    const description = body.description || body.default_memo;
    const amount = body.amount;
    const currency = body.currency || 'EUR';
    const type = body.type || 'fixed';

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    // Get handle for QR data
    const alias = await db.getAliasByPk(publicKey);
    const handle = alias?.handle || publicKey.substring(0, 8);

    const qrCode = generateQRCode();

    // Build QR data
    const qrData = {
      type: 'gns_pay',
      handle,
      amount: amount ? parseFloat(amount) : undefined,
      currency,
      reference: qrCode,
    };

    // Match QrCodeInput type
    const qr = await db.createQrCode({
      user_pk: publicKey,
      owner_pk: publicKey,
      merchant_id: publicKey,
      type,
      reference: qrCode,
      amount: amount ? parseFloat(amount) : undefined,
      currency,
      data: qrData,
      memo: name,
      default_memo: description || undefined,
    });

    if (!qr) {
      return res.status(500).json({ success: false, error: 'Failed to create QR code' });
    }

    return res.json({
      success: true,
      qrCode: {
        id: qr.id,
        code: qr.reference,
        name: qr.memo,
        description: qr.default_memo,
        amount: qr.amount,
        currency: qr.currency,
        type: qr.type,
        qrData: qr.data,
        createdAt: qr.created_at,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('POST /api/qr/create error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/qr/:id - Get QR code details
router.get('/qr/:id', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { id } = req.params;

    const qr = await db.getQrCode(id);

    if (!qr) {
      return res.status(404).json({ success: false, error: 'QR code not found' });
    }

    if (qr.user_pk !== publicKey && qr.merchant_id !== publicKey) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    return res.json({
      success: true,
      qrCode: {
        id: qr.id,
        code: qr.reference || qr.qr_code,
        name: qr.memo || qr.name,
        description: qr.default_memo || qr.description,
        amount: qr.amount,
        currency: qr.currency,
        type: qr.type,
        status: qr.is_active ? 'active' : 'inactive',
        qrData: qr.data,
        scanCount: qr.scan_count || 0,
        createdAt: qr.created_at,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('GET /api/qr/:id error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/qr/:id - Delete QR code
router.delete('/qr/:id', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { id } = req.params;

    const qr = await db.getQrCode(id);

    if (!qr) {
      return res.status(404).json({ success: false, error: 'QR code not found' });
    }

    if (qr.user_pk !== publicKey && qr.merchant_id !== publicKey) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await db.deactivateQrCode(id, publicKey);

    return res.json({ success: true, message: 'QR code deleted' } as ApiResponse);

  } catch (error) {
    console.error('DELETE /api/qr/:id error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
