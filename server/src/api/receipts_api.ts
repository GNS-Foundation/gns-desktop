// ===========================================
// GNS NODE - RECEIPTS API (Sprint 5)
// /receipts endpoints for digital receipt management
//
// Location: src/api/receipts.ts
//
// ENDPOINTS:
//   POST /receipts/store      - Store a new receipt
//   GET  /receipts/:id        - Get receipt by ID
//   GET  /receipts            - Get user's receipts
//   GET  /receipts/verify/:hash - Verify receipt by tx hash
//   GET  /receipts/export     - Export receipts as JSON
// ===========================================

import { Router, Request, Response } from 'express';
import { isValidPublicKey } from '../lib/crypto';
import * as db from '../lib/db';
import { ApiResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';

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

    if (!publicKey || !isValidPublicKey(publicKey)) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid X-GNS-PublicKey header',
      } as ApiResponse);
    }

    req.gnsPublicKey = publicKey;
    next();
  } catch (error) {
    console.error('Receipt auth error:', error);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

// ===========================================
// POST /receipts/store
// Store a new receipt
// ===========================================

router.post('/store', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      receipt_id,
      transaction_hash,
      merchant_id,
      merchant_name,
      amount,
      currency,
      order_id,
      timestamp,
      status,
      metadata,
    } = req.body;

    const userPk = req.gnsPublicKey!;

    // Validate required fields
    if (!transaction_hash || !merchant_id || !amount || !currency) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: transaction_hash, merchant_id, amount, currency',
      } as ApiResponse);
    }

    // Check for duplicate
    const existing = await db.getReceiptByTxHash(transaction_hash);
    if (existing) {
      return res.json({
        success: true,
        data: {
          receipt_id: existing.receipt_id,
          message: 'Receipt already exists',
        },
      } as ApiResponse);
    }

    // Generate receipt ID if not provided
    const finalReceiptId = receipt_id || `RCP-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Store receipt
    const receipt = await db.createReceipt({
      receipt_id: finalReceiptId,
      transaction_hash,
      merchant_id,
      merchant_name,
      user_pk: userPk,
      amount: amount.toString(),
      currency,
      order_id,
      timestamp: timestamp || new Date().toISOString(),
      status: status || 'confirmed',
      metadata: metadata || {},
    });

    console.log(`🧾 Receipt stored: ${finalReceiptId} (${currency} ${amount})`);

    return res.status(201).json({
      success: true,
      data: {
        receipt_id: finalReceiptId,
        status: receipt.status,
        stored_at: receipt.created_at,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('POST /receipts/store error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /receipts/:receiptId
// Get receipt by ID
// ===========================================

router.get('/:receiptId', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { receiptId } = req.params;
    const userPk = req.gnsPublicKey!;

    const receipt = await db.getReceipt(receiptId);

    if (!receipt) {
      return res.status(404).json({
        success: false,
        error: 'Receipt not found',
      } as ApiResponse);
    }

    // Verify ownership
    if (receipt.user_pk !== userPk) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: {
        receipt_id: receipt.receipt_id,
        transaction_hash: receipt.transaction_hash,
        merchant_id: receipt.merchant_id,
        merchant_name: receipt.merchant_name,
        amount: receipt.amount,
        currency: receipt.currency,
        order_id: receipt.order_id,
        timestamp: receipt.timestamp,
        status: receipt.status,
        metadata: receipt.metadata,
        explorer_url: `https://stellar.expert/explorer/public/tx/${receipt.transaction_hash}`,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('GET /receipts/:receiptId error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /receipts
// Get user's receipts
// ===========================================

router.get('/', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { 
      limit = '50', 
      offset = '0',
      merchant_id,
      since,
      until,
      currency,
    } = req.query;

    const receipts = await db.getUserReceipts(userPk, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      merchantId: merchant_id as string,
      since: since as string,
      until: until as string,
      currency: currency as string,
    });

    // Calculate summary
    const summary: Record<string, { total: number; count: number }> = {};
    
    for (const receipt of receipts) {
      if (receipt.status === 'confirmed') {
        const curr = receipt.currency;
        if (!summary[curr]) {
          summary[curr] = { total: 0, count: 0 };
        }
        summary[curr].total += parseFloat(receipt.amount);
        summary[curr].count += 1;
      }
    }

    return res.json({
      success: true,
      data: {
        receipts: receipts.map(r => ({
          receipt_id: r.receipt_id,
          transaction_hash: r.transaction_hash,
          merchant_id: r.merchant_id,
          merchant_name: r.merchant_name,
          amount: r.amount,
          currency: r.currency,
          order_id: r.order_id,
          timestamp: r.timestamp,
          status: r.status,
        })),
        summary: Object.entries(summary).map(([currency, data]) => ({
          currency,
          total: data.total.toFixed(2),
          count: data.count,
        })),
        total: receipts.length,
        offset: parseInt(offset as string),
        limit: parseInt(limit as string),
      },
    } as ApiResponse);

  } catch (error) {
    console.error('GET /receipts error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /receipts/verify/:txHash
// Verify receipt by transaction hash (public endpoint)
// ===========================================

router.get('/verify/:txHash', async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;

    // Look up receipt by transaction hash
    const receipt = await db.getReceiptByTxHash(txHash);

    if (!receipt) {
      // Try to verify directly on Stellar
      const stellarVerified = await verifyStellarTransaction(txHash);
      
      return res.json({
        success: true,
        data: {
          found: false,
          stellar_verified: stellarVerified,
          message: stellarVerified 
            ? 'Transaction exists on Stellar but no GNS receipt found'
            : 'Transaction not found',
        },
      } as ApiResponse);
    }

    // Return verification data (limited info for privacy)
    return res.json({
      success: true,
      data: {
        found: true,
        receipt_id: receipt.receipt_id,
        merchant_name: receipt.merchant_name,
        amount: receipt.amount,
        currency: receipt.currency,
        timestamp: receipt.timestamp,
        status: receipt.status,
        stellar_verified: true,
        explorer_url: `https://stellar.expert/explorer/public/tx/${txHash}`,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('GET /receipts/verify/:txHash error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /receipts/export
// Export receipts as JSON
// ===========================================

router.get('/export', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { since, until, format = 'json' } = req.query;

    const receipts = await db.getUserReceipts(userPk, {
      limit: 1000,
      since: since as string,
      until: until as string,
    });

    // Calculate totals by currency
    const totals: Record<string, number> = {};
    for (const receipt of receipts) {
      if (receipt.status === 'confirmed') {
        totals[receipt.currency] = (totals[receipt.currency] || 0) + parseFloat(receipt.amount);
      }
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      user_pk_prefix: userPk.substring(0, 8) + '...',
      period: {
        from: since || 'all time',
        to: until || new Date().toISOString(),
      },
      totals: Object.entries(totals).map(([currency, total]) => ({
        currency,
        total: total.toFixed(2),
      })),
      receipt_count: receipts.length,
      receipts: receipts.map(r => ({
        receipt_id: r.receipt_id,
        transaction_hash: r.transaction_hash,
        merchant_id: r.merchant_id,
        merchant_name: r.merchant_name,
        amount: r.amount,
        currency: r.currency,
        order_id: r.order_id,
        timestamp: r.timestamp,
        status: r.status,
      })),
    };

    if (format === 'csv') {
      // Generate CSV
      const csv = generateCSV(receipts);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="gns-receipts-${Date.now()}.csv"`);
      return res.send(csv);
    }

    // JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="gns-receipts-${Date.now()}.json"`);
    return res.json(exportData);

  } catch (error) {
    console.error('GET /receipts/export error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /receipts/stats
// Get receipt statistics
// ===========================================

router.get('/stats', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;

    const stats = await db.getReceiptStats(userPk);

    return res.json({
      success: true,
      data: {
        total_receipts: stats.totalReceipts,
        total_by_currency: stats.totalByCurrency,
        top_merchants: stats.topMerchants,
        spending_by_month: stats.spendingByMonth,
        average_transaction: stats.averageTransaction,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('GET /receipts/stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

async function verifyStellarTransaction(txHash: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://horizon.stellar.org/transactions/${txHash}`
    );
    return response.status === 200;
  } catch (e) {
    return false;
  }
}

function generateCSV(receipts: any[]): string {
  const headers = [
    'Receipt ID',
    'Transaction Hash',
    'Merchant ID',
    'Merchant Name',
    'Amount',
    'Currency',
    'Order ID',
    'Timestamp',
    'Status',
  ];

  const rows = receipts.map(r => [
    r.receipt_id,
    r.transaction_hash,
    r.merchant_id,
    `"${r.merchant_name}"`, // Quote merchant name in case it has commas
    r.amount,
    r.currency,
    r.order_id || '',
    r.timestamp,
    r.status,
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
}

export default router;

// ===========================================
// DB SCHEMA FOR RECEIPTS (Add to db_payments.ts)
// ===========================================

/*
-- Receipts table
CREATE TABLE IF NOT EXISTS gns_receipts (
  id SERIAL PRIMARY KEY,
  receipt_id TEXT UNIQUE NOT NULL,
  transaction_hash TEXT NOT NULL,
  merchant_id TEXT,
  merchant_name TEXT,
  user_pk TEXT NOT NULL,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  order_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'confirmed',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_receipts_user ON gns_receipts(user_pk);
CREATE INDEX IF NOT EXISTS idx_receipts_merchant ON gns_receipts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_tx_hash ON gns_receipts(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_receipts_timestamp ON gns_receipts(timestamp);

-- DB Functions to add:

export async function createReceipt(data: {
  receipt_id: string;
  transaction_hash: string;
  merchant_id: string;
  merchant_name: string;
  user_pk: string;
  amount: string;
  currency: string;
  order_id?: string;
  timestamp: string;
  status: string;
  metadata: any;
}): Promise<any> {
  const { data: receipt, error } = await getSupabase()
    .from('gns_receipts')
    .insert({
      receipt_id: data.receipt_id,
      transaction_hash: data.transaction_hash,
      merchant_id: data.merchant_id,
      merchant_name: data.merchant_name,
      user_pk: data.user_pk,
      amount: data.amount,
      currency: data.currency,
      order_id: data.order_id,
      timestamp: data.timestamp,
      status: data.status,
      metadata: data.metadata,
    })
    .select()
    .single();

  if (error) throw error;
  return receipt;
}

export async function getReceipt(receiptId: string): Promise<any | null> {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('*')
    .eq('receipt_id', receiptId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getReceiptByTxHash(txHash: string): Promise<any | null> {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('*')
    .eq('transaction_hash', txHash)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getUserReceipts(userPk: string, options: {
  limit: number;
  offset?: number;
  merchantId?: string;
  since?: string;
  until?: string;
  currency?: string;
}): Promise<any[]> {
  let query = getSupabase()
    .from('gns_receipts')
    .select('*')
    .eq('user_pk', userPk)
    .order('timestamp', { ascending: false })
    .limit(options.limit);

  if (options.offset) {
    query = query.range(options.offset, options.offset + options.limit - 1);
  }
  if (options.merchantId) {
    query = query.eq('merchant_id', options.merchantId);
  }
  if (options.since) {
    query = query.gte('timestamp', options.since);
  }
  if (options.until) {
    query = query.lte('timestamp', options.until);
  }
  if (options.currency) {
    query = query.eq('currency', options.currency);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getReceiptStats(userPk: string): Promise<{
  totalReceipts: number;
  totalByCurrency: { currency: string; total: number }[];
  topMerchants: { merchant_name: string; count: number }[];
  spendingByMonth: { month: string; total: number }[];
  averageTransaction: number;
}> {
  // Implementation would use SQL aggregations
  // Simplified version:
  const receipts = await getUserReceipts(userPk, { limit: 1000 });
  
  const totalByCurrency: Record<string, number> = {};
  const merchantCounts: Record<string, number> = {};
  let total = 0;

  for (const r of receipts) {
    if (r.status === 'confirmed') {
      const amount = parseFloat(r.amount);
      totalByCurrency[r.currency] = (totalByCurrency[r.currency] || 0) + amount;
      merchantCounts[r.merchant_name] = (merchantCounts[r.merchant_name] || 0) + 1;
      total += amount;
    }
  }

  return {
    totalReceipts: receipts.length,
    totalByCurrency: Object.entries(totalByCurrency).map(([currency, total]) => ({ currency, total })),
    topMerchants: Object.entries(merchantCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([merchant_name, count]) => ({ merchant_name, count })),
    spendingByMonth: [], // Would need date aggregation
    averageTransaction: receipts.length > 0 ? total / receipts.length : 0,
  };
}
*/
