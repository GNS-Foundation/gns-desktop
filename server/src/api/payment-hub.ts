// ===========================================
// GNS NODE - SPRINT 8 PAYMENT HUB API
// Payment Links, Invoices, and QR Codes
//
// Location: src/api/payment-hub.ts
//
// ENDPOINTS:
//   Payment Links:
//     GET  /api/link/list           - List user's payment links
//     POST /api/link/create         - Create payment link
//     PUT  /api/link/:id/deactivate - Deactivate link
//     GET  /api/link/:code          - Get public link info
//     POST /api/link/:code/pay      - Pay via link
//
//   Invoices:
//     GET  /api/invoice/list        - List user's invoices
//     POST /api/invoice/create      - Create invoice
//     GET  /api/invoice/:id         - Get invoice
//     POST /api/invoice/:id/send    - Send invoice
//     POST /api/invoice/:id/paid    - Mark as paid
//
//   QR Codes:
//     GET  /api/qr/list             - List user's QR codes
//     POST /api/qr/create           - Create QR code
//     GET  /api/qr/:id              - Get QR code
//     DELETE /api/qr/:id            - Delete QR code
//
// REQUIRES: Run sprint8_migration.sql in Supabase first
// ===========================================

import { Router, Request, Response } from 'express';
import { isValidPublicKey } from '../lib/crypto';
import * as db from '../lib/db';
import { ApiResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';
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
  // Generate 8-character alphanumeric code
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function generateQRCode(): string {
  // Generate 12-character alphanumeric code
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

// ===========================================
// PAYMENT LINKS ENDPOINTS
// ===========================================

/**
 * GET /api/link/list
 * List all payment links for authenticated user
 */
router.get('/link/list', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    
    const links = await db.getPaymentLinksByOwner(publicKey);
    
    return res.json({
      success: true,
      links: links || [],
    });
  } catch (error) {
    console.error('GET /link/list error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch payment links',
    });
  }
});

/**
 * POST /api/link/create
 * Create a new payment link
 */
router.post('/link/create', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { title, description, amount, currency = 'EUR', type = 'one_time' } = req.body;

    if (!title || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Title and amount are required',
      });
    }

    const linkCode = generateLinkCode();
    const linkId = uuidv4();
    
    const link = await db.createPaymentLink({
      id: linkId,
      code: linkCode,
      owner_pk: publicKey,
      title,
      description: description || null,
      amount: parseFloat(amount),
      currency,
      type, // 'one_time' or 'reusable'
      status: 'active',
      created_at: new Date().toISOString(),
      payment_count: 0,
      total_received: 0,
    });

    return res.json({
      success: true,
      link: {
        id: linkId,
        code: linkCode,
        title,
        description,
        amount: parseFloat(amount),
        currency,
        type,
        status: 'active',
        url: `https://panthera.gcrumbs.com/pay/${linkCode}`,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('POST /link/create error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create payment link',
    });
  }
});

/**
 * PUT /api/link/:id/deactivate
 * Deactivate a payment link
 */
router.put('/link/:id/deactivate', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { id } = req.params;

    const link = await db.getPaymentLink(id);
    
    if (!link) {
      return res.status(404).json({
        success: false,
        error: 'Payment link not found',
      });
    }

    if (link.owner_pk !== publicKey) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to modify this link',
      });
    }

    await db.updatePaymentLinkStatus(id, 'inactive');

    return res.json({
      success: true,
      message: 'Payment link deactivated',
    });
  } catch (error) {
    console.error('PUT /link/:id/deactivate error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to deactivate link',
    });
  }
});

/**
 * GET /api/link/:code
 * Get public payment link info (no auth required)
 */
router.get('/link/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    
    const link = await db.getPaymentLinkByCode(code);
    
    if (!link || link.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: 'Payment link not found or inactive',
      });
    }

    // Get owner's handle
    const ownerAlias = await db.getAliasByPublicKey(link.owner_pk);

    return res.json({
      success: true,
      link: {
        code: link.code,
        title: link.title,
        description: link.description,
        amount: link.amount,
        currency: link.currency,
        recipientHandle: ownerAlias?.handle ? `@${ownerAlias.handle}` : null,
        recipientPublicKey: link.owner_pk,
      },
    });
  } catch (error) {
    console.error('GET /link/:code error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch payment link',
    });
  }
});

// ===========================================
// INVOICE ENDPOINTS
// ===========================================

/**
 * GET /api/invoice/list
 * List all invoices for authenticated user
 */
router.get('/invoice/list', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    
    const invoices = await db.getInvoicesByOwner(publicKey);
    
    return res.json({
      success: true,
      invoices: invoices || [],
    });
  } catch (error) {
    console.error('GET /invoice/list error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch invoices',
    });
  }
});

/**
 * POST /api/invoice/create
 * Create a new invoice
 */
router.post('/invoice/create', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { 
      customerName, 
      customerEmail, 
      customerHandle,
      items = [], 
      currency = 'EUR',
      dueDate,
      notes 
    } = req.body;

    if (!customerName && !customerHandle) {
      return res.status(400).json({
        success: false,
        error: 'Customer name or handle is required',
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one item is required',
      });
    }

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.quantity || 1) * parseFloat(item.unitPrice || 0));
    }, 0);
    const tax = subtotal * 0.22; // 22% VAT (Italy)
    const total = subtotal + tax;

    const invoiceId = uuidv4();
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    
    const invoice = await db.createInvoice({
      id: invoiceId,
      invoice_number: invoiceNumber,
      owner_pk: publicKey,
      customer_name: customerName,
      customer_email: customerEmail || null,
      customer_handle: customerHandle || null,
      items: JSON.stringify(items),
      subtotal,
      tax,
      total,
      currency,
      status: 'draft',
      due_date: dueDate || null,
      notes: notes || null,
      created_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      invoice: {
        id: invoiceId,
        invoiceNumber,
        customerName,
        customerEmail,
        customerHandle,
        items,
        subtotal,
        tax,
        total,
        currency,
        status: 'draft',
        dueDate,
        notes,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('POST /invoice/create error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create invoice',
    });
  }
});

/**
 * GET /api/invoice/:id
 * Get invoice details
 */
router.get('/invoice/:id', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { id } = req.params;

    const invoice = await db.getInvoice(id);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    // Only owner or recipient can view
    if (invoice.owner_pk !== publicKey && invoice.customer_handle !== publicKey) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this invoice',
      });
    }

    return res.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        customerName: invoice.customer_name,
        customerEmail: invoice.customer_email,
        customerHandle: invoice.customer_handle,
        items: JSON.parse(invoice.items || '[]'),
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.due_date,
        notes: invoice.notes,
        createdAt: invoice.created_at,
        sentAt: invoice.sent_at,
        paidAt: invoice.paid_at,
      },
    });
  } catch (error) {
    console.error('GET /invoice/:id error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch invoice',
    });
  }
});

/**
 * POST /api/invoice/:id/send
 * Send invoice to customer
 */
router.post('/invoice/:id/send', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { id } = req.params;

    const invoice = await db.getInvoice(id);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    if (invoice.owner_pk !== publicKey) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to send this invoice',
      });
    }

    await db.updateInvoiceStatus(id, 'sent', { sent_at: new Date().toISOString() });

    // TODO: Send actual notification to customer (email or GNS message)

    return res.json({
      success: true,
      message: 'Invoice sent',
    });
  } catch (error) {
    console.error('POST /invoice/:id/send error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send invoice',
    });
  }
});

/**
 * POST /api/invoice/:id/paid
 * Mark invoice as paid
 */
router.post('/invoice/:id/paid', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { id } = req.params;
    const { transactionId, paymentMethod = 'stellar' } = req.body;

    const invoice = await db.getInvoice(id);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    if (invoice.owner_pk !== publicKey) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this invoice',
      });
    }

    await db.updateInvoiceStatus(id, 'paid', { 
      paid_at: new Date().toISOString(),
      transaction_id: transactionId,
      payment_method: paymentMethod,
    });

    return res.json({
      success: true,
      message: 'Invoice marked as paid',
    });
  } catch (error) {
    console.error('POST /invoice/:id/paid error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update invoice',
    });
  }
});

// ===========================================
// QR CODE ENDPOINTS
// ===========================================

/**
 * GET /api/qr/list
 * List all QR codes for authenticated user
 */
router.get('/qr/list', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    
    const qrCodes = await db.getQRCodesByOwner(publicKey);
    
    return res.json({
      success: true,
      qrCodes: qrCodes || [],
    });
  } catch (error) {
    console.error('GET /qr/list error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch QR codes',
    });
  }
});

/**
 * POST /api/qr/create
 * Create a new QR code for payments
 */
router.post('/qr/create', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { 
      name, 
      amount, 
      currency = 'EUR', 
      type = 'fixed', // 'fixed' or 'dynamic' (user enters amount)
      description 
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
      });
    }

    if (type === 'fixed' && !amount) {
      return res.status(400).json({
        success: false,
        error: 'Amount is required for fixed QR codes',
      });
    }

    const qrId = uuidv4();
    const qrCode = generateQRCode();

    // Get owner's handle for the QR data
    const ownerAlias = await db.getAliasByPublicKey(publicKey);
    const handle = ownerAlias?.handle || publicKey.substring(0, 16);

    // GNS QR payment URI format: gns:pay/<handle>?amount=<amount>&currency=<currency>&ref=<qrCode>
    const qrData = type === 'fixed'
      ? `gns:pay/${handle}?amount=${amount}&currency=${currency}&ref=${qrCode}`
      : `gns:pay/${handle}?ref=${qrCode}`;
    
    const qr = await db.createQRCode({
      id: qrId,
      code: qrCode,
      owner_pk: publicKey,
      name,
      description: description || null,
      amount: amount ? parseFloat(amount) : null,
      currency,
      type,
      qr_data: qrData,
      status: 'active',
      created_at: new Date().toISOString(),
      scan_count: 0,
    });

    return res.json({
      success: true,
      qrCode: {
        id: qrId,
        code: qrCode,
        name,
        description,
        amount: amount ? parseFloat(amount) : null,
        currency,
        type,
        qrData,
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('POST /qr/create error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create QR code',
    });
  }
});

/**
 * GET /api/qr/:id
 * Get QR code details
 */
router.get('/qr/:id', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { id } = req.params;

    const qr = await db.getQRCode(id);
    
    if (!qr) {
      return res.status(404).json({
        success: false,
        error: 'QR code not found',
      });
    }

    if (qr.owner_pk !== publicKey) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this QR code',
      });
    }

    return res.json({
      success: true,
      qrCode: {
        id: qr.id,
        code: qr.code,
        name: qr.name,
        description: qr.description,
        amount: qr.amount,
        currency: qr.currency,
        type: qr.type,
        qrData: qr.qr_data,
        status: qr.status,
        scanCount: qr.scan_count,
        createdAt: qr.created_at,
      },
    });
  } catch (error) {
    console.error('GET /qr/:id error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch QR code',
    });
  }
});

/**
 * DELETE /api/qr/:id
 * Delete/deactivate a QR code
 */
router.delete('/qr/:id', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const publicKey = req.gnsPublicKey!;
    const { id } = req.params;

    const qr = await db.getQRCode(id);
    
    if (!qr) {
      return res.status(404).json({
        success: false,
        error: 'QR code not found',
      });
    }

    if (qr.owner_pk !== publicKey) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this QR code',
      });
    }

    await db.updateQRCodeStatus(id, 'deleted');

    return res.json({
      success: true,
      message: 'QR code deleted',
    });
  } catch (error) {
    console.error('DELETE /qr/:id error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete QR code',
    });
  }
});

export default router;
