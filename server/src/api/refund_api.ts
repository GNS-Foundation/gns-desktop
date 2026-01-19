// ===========================================
// GNS NODE - REFUND API (Sprint 6)
// /refunds endpoints for payment reversals
//
// Location: src/api/refunds.ts
//
// ENDPOINTS:
//   POST /refunds/request         - User requests refund
//   GET  /refunds/:id             - Get refund details
//   GET  /refunds/user            - Get user's refunds
//   GET  /refunds/merchant        - Get merchant's refunds
//   POST /refunds/:id/approve     - Merchant approves refund
//   POST /refunds/:id/reject      - Merchant rejects refund
//   POST /refunds/:id/cancel      - User cancels pending refund
//
// REFUND FLOW:
//   1. User: POST /refunds/request → creates pending refund
//   2. Merchant: GET /refunds/merchant → sees pending refunds
//   3. Merchant: POST /refunds/:id/approve → executes Stellar refund
//   4. User receives funds, receipt updated
// ===========================================

import { Router, Request, Response } from 'express';
import { isValidPublicKey, verifySignature } from '../lib/crypto';
import * as db from '../lib/db';
import { StellarService } from '../lib/stellar_service';
import { ApiResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

const router = Router();
const stellarService = new StellarService();

// ===========================================
// TYPES
// ===========================================

interface UserRequest extends Request {
  gnsPublicKey?: string;
}

interface MerchantRequest extends Request {
  merchantId?: string;
}

type RefundStatus = 'pending' | 'approved' | 'processing' | 'completed' | 'rejected' | 'failed' | 'cancelled';

type RefundReason = 
  | 'customer_request'
  | 'duplicate_payment'
  | 'incorrect_amount'
  | 'product_not_received'
  | 'product_defective'
  | 'service_not_provided'
  | 'fraudulent'
  | 'merchant_initiated'
  | 'other';

interface RefundRequestBody {
  original_transaction_hash: string;
  original_receipt_id: string;
  merchant_id: string;
  refund_amount?: number;
  reason: RefundReason;
  reason_details?: string;
}

// ===========================================
// AUTH MIDDLEWARE
// ===========================================

/**
 * Verify user authentication via signature
 */
const verifyUserAuth = async (
  req: UserRequest,
  res: Response,
  next: Function
) => {
  try {
    const publicKey = req.headers['x-gns-public-key'] as string;
    const signature = req.headers['x-gns-signature'] as string;

    if (!publicKey) {
      return res.status(401).json({
        success: false,
        error: 'Missing X-GNS-Public-Key header',
      } as ApiResponse);
    }

    if (!isValidPublicKey(publicKey)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid public key format',
      } as ApiResponse);
    }

    req.gnsPublicKey = publicKey.toLowerCase();
    next();
  } catch (error) {
    console.error('User auth error:', error);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

/**
 * Verify merchant authentication via API key
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
// POST /refunds/request
// User requests a refund
// ===========================================

router.post('/request', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const {
      original_transaction_hash,
      original_receipt_id,
      merchant_id,
      refund_amount,
      reason,
      reason_details,
    } = req.body as RefundRequestBody;

    // Validate required fields
    if (!original_transaction_hash || !original_receipt_id || !merchant_id || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      } as ApiResponse);
    }

    // Get original settlement
    const settlement = await db.getSettlementByTxHash(original_transaction_hash);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: 'Original transaction not found',
      } as ApiResponse);
    }

    // Verify user owns the transaction
    if (settlement.user_pk.toLowerCase() !== userPk) {
      return res.status(403).json({
        success: false,
        error: 'Transaction does not belong to user',
      } as ApiResponse);
    }

    // Check if already refunded
    if (settlement.status === 'refunded') {
      return res.status(400).json({
        success: false,
        error: 'Transaction already refunded',
      } as ApiResponse);
    }

    // Check for existing pending refund
    const existingRefund = await db.getPendingRefundForSettlement(settlement.settlement_id);
    if (existingRefund) {
      return res.status(400).json({
        success: false,
        error: 'Refund request already pending for this transaction',
      } as ApiResponse);
    }

    // Validate refund amount
    const originalAmount = parseFloat(settlement.amount);
    const requestedAmount = refund_amount ?? originalAmount;

    if (requestedAmount <= 0 || requestedAmount > originalAmount) {
      return res.status(400).json({
        success: false,
        error: 'Invalid refund amount',
      } as ApiResponse);
    }

    // Check refund window (90 days)
    const settlementDate = new Date(settlement.completed_at || settlement.created_at);
    const daysSinceSettlement = Math.floor(
      (Date.now() - settlementDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceSettlement > 90) {
      return res.status(400).json({
        success: false,
        error: 'Refund window has expired (90 days)',
      } as ApiResponse);
    }

    // Create refund request
    const refundId = `REF-${uuidv4().substring(0, 8).toUpperCase()}`;
    
    const refund = await db.createRefundRequest({
      refund_id: refundId,
      settlement_id: settlement.settlement_id,
      original_transaction_hash,
      original_receipt_id,
      merchant_id,
      user_pk: userPk,
      original_amount: originalAmount.toString(),
      refund_amount: requestedAmount.toString(),
      currency: settlement.asset_code,
      reason,
      reason_details: reason_details || null,
      status: 'pending',
    });

    console.log(`🔄 Refund requested: ${refundId} for ${requestedAmount} ${settlement.asset_code}`);

    // Notify merchant (TODO: implement notification system)
    // await notifyMerchant(merchant_id, 'refund_requested', refund);

    return res.status(201).json({
      success: true,
      data: refund,
      message: 'Refund request submitted',
    } as ApiResponse);

  } catch (error) {
    console.error('POST /refunds/request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /refunds/:id
// Get refund details
// ===========================================

router.get('/:id', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userPk = req.gnsPublicKey!;

    const refund = await db.getRefund(id);
    if (!refund) {
      return res.status(404).json({
        success: false,
        error: 'Refund not found',
      } as ApiResponse);
    }

    // Verify access (user or merchant)
    if (refund.user_pk.toLowerCase() !== userPk) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: refund,
    } as ApiResponse);

  } catch (error) {
    console.error('GET /refunds/:id error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /refunds/user
// Get user's refunds
// ===========================================

router.get('/user', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { status, limit = '50', offset = '0' } = req.query;

    const refunds = await db.getUserRefunds(userPk, {
      status: status as RefundStatus | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    return res.json({
      success: true,
      data: refunds,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: refunds.length,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('GET /refunds/user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /refunds/merchant
// Get merchant's refund requests
// ===========================================

router.get('/merchant', verifyMerchantAuth, async (req: MerchantRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const { status, limit = '50', offset = '0' } = req.query;

    const refunds = await db.getMerchantRefunds(merchantId, {
      status: status as RefundStatus | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    return res.json({
      success: true,
      data: refunds,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: refunds.length,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('GET /refunds/merchant error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// POST /refunds/:id/approve
// Merchant approves and executes refund
// ===========================================

router.post('/:id/approve', verifyMerchantAuth, async (req: MerchantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const merchantId = req.merchantId!;

    // Get refund
    const refund = await db.getRefund(id);
    if (!refund) {
      return res.status(404).json({
        success: false,
        error: 'Refund not found',
      } as ApiResponse);
    }

    // Verify merchant owns refund
    if (refund.merchant_id !== merchantId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      } as ApiResponse);
    }

    // Check status
    if (refund.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Refund cannot be approved (status: ${refund.status})`,
      } as ApiResponse);
    }

    // Update status to processing
    await db.updateRefundStatus(id, 'processing');

    // Get merchant's Stellar address and execute refund
    const merchant = await db.getMerchant(merchantId);
    if (!merchant) {
      await db.updateRefundStatus(id, 'failed', 'Merchant not found');
      return res.status(500).json({
        success: false,
        error: 'Merchant configuration error',
      } as ApiResponse);
    }

    // Execute Stellar refund (merchant → user)
    const refundAmount = parseFloat(refund.refund_amount);
    let txResult;

    try {
      switch (refund.currency.toUpperCase()) {
        case 'GNS':
          txResult = await stellarService.sendGns({
            from: merchant.stellar_address,
            to: refund.user_stellar_address,
            amount: refundAmount,
            memo: `Refund: ${refund.refund_id}`,
          });
          break;
        case 'USDC':
          txResult = await stellarService.sendUsdc({
            from: merchant.stellar_address,
            to: refund.user_stellar_address,
            amount: refundAmount,
            memo: `Refund: ${refund.refund_id}`,
          });
          break;
        case 'EURC':
          txResult = await stellarService.sendEurc({
            from: merchant.stellar_address,
            to: refund.user_stellar_address,
            amount: refundAmount,
            memo: `Refund: ${refund.refund_id}`,
          });
          break;
        default:
          throw new Error(`Unsupported currency: ${refund.currency}`);
      }
    } catch (stellarError: any) {
      await db.updateRefundStatus(id, 'failed', stellarError.message);
      return res.status(500).json({
        success: false,
        error: `Stellar transaction failed: ${stellarError.message}`,
      } as ApiResponse);
    }

    if (!txResult.success) {
      await db.updateRefundStatus(id, 'failed', txResult.error);
      return res.status(500).json({
        success: false,
        error: `Refund failed: ${txResult.error}`,
      } as ApiResponse);
    }

    // Update refund with transaction hash
    const updatedRefund = await db.completeRefund(id, {
      refund_transaction_hash: txResult.hash,
      processed_at: new Date().toISOString(),
      processed_by: merchantId,
    });

    // Update original settlement status
    await db.updateSettlementStatus(refund.settlement_id, 'refunded');

    console.log(`✅ Refund approved: ${id} → ${txResult.hash}`);

    return res.json({
      success: true,
      data: updatedRefund,
      message: 'Refund processed successfully',
    } as ApiResponse);

  } catch (error) {
    console.error('POST /refunds/:id/approve error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// POST /refunds/:id/reject
// Merchant rejects refund
// ===========================================

router.post('/:id/reject', verifyMerchantAuth, async (req: MerchantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const merchantId = req.merchantId!;
    const { rejection_reason } = req.body;

    // Get refund
    const refund = await db.getRefund(id);
    if (!refund) {
      return res.status(404).json({
        success: false,
        error: 'Refund not found',
      } as ApiResponse);
    }

    // Verify merchant owns refund
    if (refund.merchant_id !== merchantId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      } as ApiResponse);
    }

    // Check status
    if (refund.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Refund cannot be rejected (status: ${refund.status})`,
      } as ApiResponse);
    }

    // Update refund
    const updatedRefund = await db.rejectRefund(id, {
      rejection_reason: rejection_reason || 'Rejected by merchant',
      processed_at: new Date().toISOString(),
      processed_by: merchantId,
    });

    console.log(`❌ Refund rejected: ${id}`);

    return res.json({
      success: true,
      data: updatedRefund,
      message: 'Refund rejected',
    } as ApiResponse);

  } catch (error) {
    console.error('POST /refunds/:id/reject error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// POST /refunds/:id/cancel
// User cancels pending refund
// ===========================================

router.post('/:id/cancel', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userPk = req.gnsPublicKey!;

    // Get refund
    const refund = await db.getRefund(id);
    if (!refund) {
      return res.status(404).json({
        success: false,
        error: 'Refund not found',
      } as ApiResponse);
    }

    // Verify user owns refund
    if (refund.user_pk.toLowerCase() !== userPk) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      } as ApiResponse);
    }

    // Check status
    if (refund.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Refund cannot be cancelled (status: ${refund.status})`,
      } as ApiResponse);
    }

    // Update refund
    const updatedRefund = await db.updateRefundStatus(id, 'cancelled');

    console.log(`🚫 Refund cancelled: ${id}`);

    return res.json({
      success: true,
      data: updatedRefund,
      message: 'Refund request cancelled',
    } as ApiResponse);

  } catch (error) {
    console.error('POST /refunds/:id/cancel error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /refunds/stats
// Get refund statistics
// ===========================================

router.get('/stats', verifyMerchantAuth, async (req: MerchantRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const { period = '30d' } = req.query;

    const stats = await db.getRefundStats(merchantId, period as string);

    return res.json({
      success: true,
      data: stats,
    } as ApiResponse);

  } catch (error) {
    console.error('GET /refunds/stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

export default router;
