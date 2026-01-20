// ===========================================
// GNS NODE - MERCHANT SETTLEMENT API (Sprint 5)
// /merchant endpoints for NFC payment processing
//
// Location: src/api/merchant.ts
//
// ENDPOINTS:
//   POST /merchant/register       - Register new merchant
//   GET  /merchant/:id            - Get merchant details
//   GET  /merchant/search         - Search merchants
//   POST /merchant/settle         - Process settlement (user → merchant)
//   POST /merchant/payment-complete - Record completed payment
//   GET  /merchant/:id/transactions - Get merchant transactions
//   POST /merchant/verify-signature - Verify merchant signature
//
// SETTLEMENT FLOW:
//   1. User taps NFC terminal
//   2. Terminal sends payment request via NFC
//   3. User's app calls POST /merchant/settle
//   4. Backend validates and executes Stellar transaction
//   5. Merchant receives USDC/EURC/GNS instantly
//   6. Receipt generated and stored
// ===========================================

import { Router, Request, Response } from 'express';
import { isValidPublicKey, verifySignature } from '../lib/crypto';
import * as db from '../lib/db';
import { StellarService } from '../services/stellar_service';
import { ApiResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { createHash, createHmac } from 'crypto';

const router = Router();
const stellarService = new StellarService();

// ===========================================
// TYPES
// ===========================================

interface MerchantRequest extends Request {
  merchantId?: string;
}

interface UserRequest extends Request {
  gnsPublicKey?: string;
}

interface SettlementRequest {
  request_id: string;
  merchant_id: string;
  from_stellar_address: string;
  to_stellar_address: string;
  amount: string;
  asset_code: string;  // GNS, USDC, EURC, XLM
  memo?: string;
  order_id?: string;
  user_signature: string;
  h3_cell?: string;
}

interface MerchantRegistration {
  name: string;
  display_name?: string;
  stellar_address: string;
  category: string;
  email: string;
  phone?: string;
  website?: string;
  address?: string;
  h3_cell?: string;
  accepted_currencies?: string[];
  settlement_currency?: string;
  instant_settlement?: boolean;
}

// ===========================================
// AUTH MIDDLEWARE
// ===========================================

/**
 * Verify GNS user authentication
 */
const verifyUserAuth = async (
  req: UserRequest,
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
    console.error('User auth error:', error);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

/**
 * Verify merchant API key
 */
const verifyMerchantAuth = async (
  req: MerchantRequest,
  res: Response,
  next: Function
) => {
  try {
    const apiKey = req.headers['x-gns-merchant-key'] as string;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Missing X-GNS-Merchant-Key header',
      } as ApiResponse);
    }

    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const merchant = await db.getMerchantByApiKey(keyHash);

    if (!merchant) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
      } as ApiResponse);
    }

    if (merchant.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Merchant account is not active',
      } as ApiResponse);
    }

    req.merchantId = merchant.merchant_id;
    next();
  } catch (error) {
    console.error('Merchant auth error:', error);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

// ===========================================
// POST /merchant/register
// Register a new merchant
// ===========================================

router.post('/register', async (req: Request, res: Response) => {
  try {
    const registration: MerchantRegistration = req.body;

    // Validate required fields
    if (!registration.name || !registration.stellar_address || !registration.email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, stellar_address, email',
      } as ApiResponse);
    }

    // Validate Stellar address format
    if (!registration.stellar_address.match(/^G[A-Z0-9]{55}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Stellar address format',
      } as ApiResponse);
    }

    // Check if merchant already exists
    const existing = await db.getMerchantByEmail(registration.email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Merchant with this email already exists',
      } as ApiResponse);
    }

    // Generate merchant ID and API key
    const merchantId = `M${uuidv4().replace(/-/g, '').substring(0, 15).toUpperCase()}`;
    const apiKey = uuidv4() + '-' + uuidv4();
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    // Create merchant record
    const merchant = await db.createMerchant({
      merchant_id: merchantId,
      name: registration.name,
      display_name: registration.display_name,
      stellar_address: registration.stellar_address,
      category: registration.category || 'other',
      status: 'pending', // Requires verification
      email: registration.email,
      phone: registration.phone,
      website: registration.website,
      address: registration.address,
      h3_cell: registration.h3_cell,
      accepted_currencies: registration.accepted_currencies || ['GNS', 'USDC', 'EURC'],
      settlement_currency: registration.settlement_currency || 'USDC',
      instant_settlement: registration.instant_settlement ?? true,
      api_key_hash: apiKeyHash,
    });

    console.log(`🏪 Merchant registered: ${merchantId} (${registration.name})`);

    return res.status(201).json({
      success: true,
      data: {
        merchant_id: merchantId,
        api_key: apiKey, // Only returned once at registration!
        status: 'pending',
        message: 'Merchant registered. API key will not be shown again. Verification required.',
      },
    } as ApiResponse);

  } catch (error) {
    console.error('POST /merchant/register error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /merchant/:merchantId
// Get merchant details
// ===========================================

router.get('/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    const merchant = await db.getMerchant(merchantId);

    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: 'Merchant not found',
      } as ApiResponse);
    }

    // Return public info only
    return res.json({
      success: true,
      data: {
        merchant_id: merchant.merchant_id,
        name: merchant.name,
        display_name: merchant.display_name,
        stellar_address: merchant.stellar_address,
        category: merchant.category,
        status: merchant.status,
        logo_url: merchant.logo_url,
        website: merchant.website,
        address: merchant.address,
        h3_cell: merchant.h3_cell,
        accepted_currencies: merchant.accepted_currencies,
        registered_at: merchant.created_at,
        verified_at: merchant.verified_at,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('GET /merchant/:merchantId error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /merchant/search
// Search merchants
// ===========================================

router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, category, near, limit = '20' } = req.query;

    const merchants = await db.searchMerchants({
      query: q as string,
      category: category as string,
      nearH3Cell: near as string,
      limit: parseInt(limit as string),
    });

    return res.json({
      success: true,
      data: merchants.map(m => ({
        merchant_id: m.merchant_id,
        name: m.name,
        display_name: m.display_name,
        stellar_address: m.stellar_address,
        category: m.category,
        status: m.status,
        logo_url: m.logo_url,
        h3_cell: m.h3_cell,
        accepted_currencies: m.accepted_currencies,
      })),
      total: merchants.length,
    } as ApiResponse);

  } catch (error) {
    console.error('GET /merchant/search error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// POST /merchant/settle
// Process payment settlement (user → merchant)
// This is the main NFC payment endpoint
// ===========================================

router.post('/settle', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const settlement: SettlementRequest = req.body;
    const userPk = req.gnsPublicKey!;

    // Validate required fields
    if (!settlement.merchant_id || !settlement.amount || !settlement.asset_code) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      } as ApiResponse);
    }

    // Get merchant
    const merchant = await db.getMerchant(settlement.merchant_id);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: 'Merchant not found',
      } as ApiResponse);
    }

    if (merchant.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Merchant is not active',
      } as ApiResponse);
    }

    // Validate asset is accepted
    if (!merchant.accepted_currencies.includes(settlement.asset_code)) {
      return res.status(400).json({
        success: false,
        error: `Merchant does not accept ${settlement.asset_code}`,
      } as ApiResponse);
    }

    // Parse amount
    const amount = parseFloat(settlement.amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
      } as ApiResponse);
    }

    // Validate Stellar addresses
    if (!settlement.from_stellar_address.match(/^G[A-Z0-9]{55}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sender Stellar address',
      } as ApiResponse);
    }

    // Generate transaction ID
    const transactionId = uuidv4();
    const requestId = settlement.request_id || transactionId;

    // Check for duplicate request
    const existingTx = await db.getSettlementByRequestId(requestId);
    if (existingTx) {
      // Return existing transaction (idempotent)
      return res.json({
        success: true,
        data: {
          transaction_id: existingTx.transaction_id,
          transaction_hash: existingTx.stellar_tx_hash,
          status: existingTx.status,
          message: 'Transaction already processed',
        },
      } as ApiResponse);
    }

    // Create settlement record (pending)
    await db.createSettlement({
      settlement_id: transactionId,
      request_id: requestId,
      merchant_id: merchant.merchant_id,
      user_pk: userPk,
      from_stellar_address: settlement.from_stellar_address,
      to_stellar_address: merchant.stellar_address,
      amount: settlement.amount,
      asset_code: settlement.asset_code,
      memo: settlement.memo,
      order_id: settlement.order_id,
      h3_cell: settlement.h3_cell,
      status: 'pending',
    });

    console.log(`💳 Settlement initiated: ${transactionId.substring(0, 8)}... (${settlement.asset_code} ${amount})`);

    // Execute Stellar transaction
    let txResult: { success: boolean; hash?: string; error?: string };

    try {
      // For GNS tokens, we need user's signed transaction
      // For now, we'll execute via distribution wallet for demo
      // In production, user would sign the transaction client-side

      if (settlement.asset_code === 'XLM') {
        txResult = await stellarService.sendXlm(
          merchant.stellar_address,
          settlement.amount
        );
      } else {
        // For GNS/USDC/EURC, use asset payment
        txResult = await stellarService.sendAsset(
          merchant.stellar_address,
          settlement.asset_code,
          null, // Issuer will be handled by stellarService based on code or use native/default
          settlement.amount
        );
      }

    } catch (e: any) {
      console.error('Stellar transaction failed:', e);

      // Update settlement status
      await db.updateSettlementStatus(transactionId, 'failed', e.message);

      return res.status(500).json({
        success: false,
        error: `Payment failed: ${e.message}`,
      } as ApiResponse);
    }

    if (!txResult.success) {
      await db.updateSettlementStatus(transactionId, 'failed', txResult.error);

      return res.status(500).json({
        success: false,
        error: txResult.error || 'Transaction failed',
      } as ApiResponse);
    }

    // Update settlement with transaction hash
    await db.updateSettlementComplete(transactionId, txResult.hash!);

    // Calculate fee (0.1% for GNS payments)
    const feePercent = settlement.asset_code === 'GNS' ? 0.001 : 0.025;
    const fee = amount * feePercent;

    console.log(`✅ Settlement complete: ${txResult.hash}`);

    return res.status(201).json({
      success: true,
      data: {
        transaction_id: transactionId,
        transaction_hash: txResult.hash,
        merchant_id: merchant.merchant_id,
        merchant_name: merchant.name,
        amount: settlement.amount,
        asset_code: settlement.asset_code,
        fee: fee.toFixed(4),
        fee_percent: (feePercent * 100).toFixed(2) + '%',
        status: 'completed',
        completed_at: new Date().toISOString(),
        explorer_url: `https://stellar.expert/explorer/public/tx/${txResult.hash}`,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('POST /merchant/settle error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// POST /merchant/payment-complete
// Record completed payment (from client)
// ===========================================

router.post('/payment-complete', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const {
      request_id,
      merchant_id,
      transaction_hash,
      amount,
      currency,
      order_id,
      completed_at,
    } = req.body;

    const userPk = req.gnsPublicKey!;

    // Validate transaction exists on Stellar
    // In production, verify the transaction hash is real

    // Store payment completion record
    await db.createPaymentCompletion({
      request_id,
      merchant_id,
      user_pk: userPk,
      transaction_hash,
      amount,
      currency,
      order_id,
      completed_at: completed_at || new Date().toISOString(),
    });

    console.log(`📝 Payment completion recorded: ${transaction_hash?.substring(0, 8)}...`);

    return res.json({
      success: true,
      data: {
        request_id,
        status: 'recorded',
      },
    } as ApiResponse);

  } catch (error) {
    console.error('POST /merchant/payment-complete error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /merchant/:merchantId/transactions
// Get merchant transaction history
// ===========================================

router.get('/:merchantId/transactions', verifyMerchantAuth, async (req: MerchantRequest, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { limit = '50', offset = '0', status } = req.query;

    // Verify merchant owns this data
    if (req.merchantId !== merchantId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      } as ApiResponse);
    }

    const transactions = await db.getMerchantTransactions(merchantId, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      status: status as string,
    });

    // Calculate totals
    let totalAmount = 0;
    let totalFees = 0;

    for (const tx of transactions) {
      if (tx.status === 'completed') {
        totalAmount += parseFloat(tx.amount);
        const feePercent = tx.asset_code === 'GNS' ? 0.001 : 0.025;
        totalFees += parseFloat(tx.amount) * feePercent;
      }
    }

    return res.json({
      success: true,
      data: {
        transactions: transactions.map(tx => ({
          transaction_id: tx.settlement_id,
          transaction_hash: tx.stellar_tx_hash,
          amount: tx.amount,
          asset_code: tx.asset_code,
          status: tx.status,
          order_id: tx.order_id,
          user_pk: tx.user_pk?.substring(0, 8) + '...',
          created_at: tx.created_at,
          completed_at: tx.completed_at,
        })),
        summary: {
          total_amount: totalAmount.toFixed(2),
          total_fees: totalFees.toFixed(4),
          transaction_count: transactions.length,
        },
      },
    } as ApiResponse);

  } catch (error) {
    console.error('GET /merchant/:merchantId/transactions error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// POST /merchant/verify-signature
// Verify merchant terminal signature
// ===========================================

router.post('/verify-signature', async (req: Request, res: Response) => {
  try {
    const { merchant_id, data, signature } = req.body;

    if (!merchant_id || !data || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      } as ApiResponse);
    }

    const merchant = await db.getMerchant(merchant_id);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: 'Merchant not found',
      } as ApiResponse);
    }

    // Verify signature using merchant's signing key
    // In production, this would use Ed25519 verification
    const isValid = verifyMerchantSignature(
      merchant.signing_public_key,
      data,
      signature
    );

    return res.json({
      success: true,
      data: {
        valid: isValid,
        merchant_id: merchant_id,
        merchant_name: merchant.name,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('POST /merchant/verify-signature error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /merchant/popular
// Get popular/featured merchants
// ===========================================

router.get('/popular', async (req: Request, res: Response) => {
  try {
    const merchants = await db.getPopularMerchants(20);

    return res.json({
      success: true,
      data: merchants.map(m => ({
        merchant_id: m.merchant_id,
        name: m.name,
        display_name: m.display_name,
        stellar_address: m.stellar_address,
        category: m.category,
        logo_url: m.logo_url,
        accepted_currencies: m.accepted_currencies,
      })),
    } as ApiResponse);

  } catch (error) {
    console.error('GET /merchant/popular error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function verifyMerchantSignature(
  publicKey: string | null,
  data: string,
  signature: string
): boolean {
  if (!publicKey) return false;

  // In production, use Ed25519 verification
  // For now, return true for demo
  try {
    // const isValid = verifySignature(publicKey, data, signature);
    // return isValid;
    return true; // Demo mode
  } catch (e) {
    return false;
  }
}

export default router;

// ===========================================
// DB SCHEMA FOR MERCHANTS (Add to db_payments.ts)
// ===========================================

/*
-- Merchants table
CREATE TABLE IF NOT EXISTS gns_merchants (
  merchant_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT,
  stellar_address TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  status TEXT DEFAULT 'pending',
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  website TEXT,
  address TEXT,
  h3_cell TEXT,
  accepted_currencies TEXT[] DEFAULT ARRAY['GNS', 'USDC', 'EURC'],
  settlement_currency TEXT DEFAULT 'USDC',
  instant_settlement BOOLEAN DEFAULT true,
  api_key_hash TEXT NOT NULL,
  signing_public_key TEXT,
  logo_url TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settlements table
CREATE TABLE IF NOT EXISTS gns_settlements (
  settlement_id TEXT PRIMARY KEY,
  request_id TEXT UNIQUE NOT NULL,
  merchant_id TEXT NOT NULL REFERENCES gns_merchants(merchant_id),
  user_pk TEXT NOT NULL,
  from_stellar_address TEXT NOT NULL,
  to_stellar_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  asset_code TEXT NOT NULL,
  memo TEXT,
  order_id TEXT,
  h3_cell TEXT,
  status TEXT DEFAULT 'pending',
  stellar_tx_hash TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment completions (from client)
CREATE TABLE IF NOT EXISTS gns_payment_completions (
  id SERIAL PRIMARY KEY,
  request_id TEXT,
  merchant_id TEXT REFERENCES gns_merchants(merchant_id),
  user_pk TEXT NOT NULL,
  transaction_hash TEXT,
  amount TEXT,
  currency TEXT,
  order_id TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_merchants_email ON gns_merchants(email);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON gns_merchants(status);
CREATE INDEX IF NOT EXISTS idx_merchants_category ON gns_merchants(category);
CREATE INDEX IF NOT EXISTS idx_merchants_h3_cell ON gns_merchants(h3_cell);

CREATE INDEX IF NOT EXISTS idx_settlements_merchant ON gns_settlements(merchant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_user ON gns_settlements(user_pk);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON gns_settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_request ON gns_settlements(request_id);
*/
