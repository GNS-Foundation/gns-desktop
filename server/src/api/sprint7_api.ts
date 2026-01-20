// ===========================================
// GNS NODE - SPRINT 7 API ROUTES
// Batch Settlements, Notifications, Analytics, Subscriptions
//
// Location: src/api/sprint7.ts
// ===========================================

import { Router, Request, Response } from 'express';
import { isValidPublicKey } from '../lib/crypto';
import * as db from '../lib/db';
import { ApiResponse } from '../types';

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
// BATCH SETTLEMENT ENDPOINTS
// ===========================================

/**
 * GET /settlement/config
 * Get merchant's settlement configuration
 */
router.get('/settlement/config', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const config = await db.getSettlementConfig(merchantId);

    if (!config) {
      // Return defaults
      return res.json({
        success: true,
        data: {
          merchant_id: merchantId,
          frequency: 'daily',
          settlement_hour: 0,
          minimum_amount: 10.0,
          auto_settle: true,
          preferred_currency: 'USDC',
        },
      });
    }

    res.json({ success: true, data: config });
  } catch (error) {
    console.error('GET /settlement/config error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /settlement/config
 * Update settlement configuration
 */
router.put('/settlement/config', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const { frequency, settlement_hour, minimum_amount, auto_settle, preferred_currency, settlement_address } = req.body;

    const config = await db.upsertSettlementConfig(merchantId, {
      frequency,
      settlement_hour,
      minimum_amount,
      auto_settle,
      preferred_currency,
      settlement_address,
    });

    res.json({ success: true, data: config, message: 'Configuration updated' });
  } catch (error) {
    console.error('PUT /settlement/config error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /settlement/pending
 * Get pending batch summary
 */
router.get('/settlement/pending', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const currency = req.query.currency as string;

    const summary = await db.getPendingBatchSummary(merchantId, currency);

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('GET /settlement/pending error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /settlement/trigger
 * Manually trigger batch settlement
 */
router.post('/settlement/trigger', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const { currency } = req.body;

    // Get pending transactions
    const pending = await db.getPendingSettlementTransactions(merchantId, currency);

    if (pending.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No pending transactions to settle',
      });
    }

    // Calculate totals
    const totalGross = pending.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalFees = pending.reduce((sum, t) => sum + parseFloat(t.fee_amount || '0'), 0);
    const totalNet = totalGross - totalFees;

    // Create batch settlement
    const batch = await db.createBatchSettlement({
      merchant_id: merchantId,
      currency: currency || pending[0].currency,
      transaction_ids: pending.map(t => t.settlement_id),
      total_gross: totalGross,
      total_fees: totalFees,
      total_net: totalNet,
      transaction_count: pending.length,
    });

    // Execute Stellar settlement (single transaction for entire batch)
    // TODO: Implement actual Stellar transaction
    const stellarTxHash = `batch_${batch.batch_id}_${Date.now()}`;

    // Update batch with tx hash
    const completedBatch = await db.completeBatchSettlement(batch.batch_id, stellarTxHash);

    console.log(`📦 Batch settlement: ${merchantId} - ${pending.length} txns, $${totalNet.toFixed(2)}`);

    res.json({
      success: true,
      data: completedBatch,
      message: `Settled ${pending.length} transactions`,
    });
  } catch (error) {
    console.error('POST /settlement/trigger error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /settlement/history
 * Get settlement history
 */
router.get('/settlement/history', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const { status, limit = '50', offset = '0' } = req.query;

    const settlements = await db.getBatchSettlements(merchantId, {
      status: status as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({ success: true, data: settlements });
  } catch (error) {
    console.error('GET /settlement/history error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /settlement/:batchId
 * Get batch settlement details
 */
router.get('/settlement/:batchId', verifyMerchantAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { batchId } = req.params;
    const merchantId = req.merchantId!;

    const batch = await db.getBatchSettlement(batchId);

    if (!batch || batch.merchant_id !== merchantId) {
      return res.status(404).json({ success: false, error: 'Settlement not found' });
    }

    res.json({ success: true, data: batch });
  } catch (error) {
    console.error('GET /settlement/:batchId error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================
// NOTIFICATION ENDPOINTS
// ===========================================

/**
 * POST /notifications/devices/register
 * Register device for push notifications
 */
router.post('/notifications/devices/register', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { device_id, push_token, platform, device_name } = req.body;

    if (!device_id || !push_token || !platform) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: device_id, push_token, platform',
      });
    }

    const device = await db.registerDevice({
      user_pk: userPk,
      device_id,
      push_token,
      platform,
      device_name,
    });

    console.log(`📱 Device registered: ${userPk.substring(0, 8)}... (${platform})`);

    res.json({ success: true, data: device, message: 'Device registered' });
  } catch (error) {
    console.error('POST /notifications/devices/register error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /notifications/devices/:deviceId
 * Unregister device
 */
router.delete('/notifications/devices/:deviceId', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { deviceId } = req.params;

    await db.unregisterDevice(userPk, deviceId);

    res.json({ success: true, message: 'Device unregistered' });
  } catch (error) {
    console.error('DELETE /notifications/devices error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /notifications/preferences
 * Get notification preferences
 */
router.get('/notifications/preferences', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const prefs = await db.getNotificationPreferences(userPk);

    // Return defaults if none set
    res.json({
      success: true,
      data: prefs || {
        payment_received: true,
        payment_sent: true,
        payment_failed: true,
        payment_request: true,
        refund_updates: true,
        points_earned: true,
        tier_upgrade: true,
        reward_available: true,
        achievement_unlocked: true,
        subscription_reminders: true,
        security_alerts: true,
        system_updates: true,
        marketing_messages: false,
        quiet_hours_enabled: false,
        quiet_hours_start: 22,
        quiet_hours_end: 8,
      },
    });
  } catch (error) {
    console.error('GET /notifications/preferences error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /notifications/preferences
 * Update notification preferences
 */
router.put('/notifications/preferences', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const prefs = await db.upsertNotificationPreferences(userPk, req.body);

    res.json({ success: true, data: prefs, message: 'Preferences updated' });
  } catch (error) {
    console.error('PUT /notifications/preferences error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /notifications
 * Get notification history
 */
router.get('/notifications', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { limit = '50', offset = '0', unread_only } = req.query;

    const notifications = await db.getNotifications(userPk, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      unreadOnly: unread_only === 'true',
    });

    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('GET /notifications error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /notifications/unread/count
 * Get unread notification count
 */
router.get('/notifications/unread/count', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const count = await db.getUnreadNotificationCount(userPk);

    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('GET /notifications/unread/count error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /notifications/:id/read
 * Mark notification as read
 */
router.post('/notifications/:notificationId/read', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { notificationId } = req.params;

    await db.markNotificationRead(userPk, notificationId);

    res.json({ success: true, message: 'Marked as read' });
  } catch (error) {
    console.error('POST /notifications/:id/read error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /notifications/read-all
 * Mark all notifications as read
 */
router.post('/notifications/read-all', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    await db.markAllNotificationsRead(userPk);

    res.json({ success: true, message: 'All marked as read' });
  } catch (error) {
    console.error('POST /notifications/read-all error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================
// ANALYTICS ENDPOINTS
// ===========================================

/**
 * GET /analytics/summary
 * Get spending summary
 */
router.get('/analytics/summary', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { period = 'thisMonth', start_date, end_date } = req.query;

    const summary = await db.getSpendingSummary(userPk, {
      period: period as string,
      startDate: start_date as string,
      endDate: end_date as string,
    });

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('GET /analytics/summary error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /analytics/daily
 * Get daily spending data
 */
router.get('/analytics/daily', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { days = '30' } = req.query;

    const dailyData = await db.getDailySpending(userPk, parseInt(days as string));

    res.json({ success: true, data: dailyData });
  } catch (error) {
    console.error('GET /analytics/daily error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /analytics/categories
 * Get spending by category
 */
router.get('/analytics/categories', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { period = 'thisMonth' } = req.query;

    const categories = await db.getSpendingByCategory(userPk, period as string);

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('GET /analytics/categories error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /analytics/merchants
 * Get spending by merchant
 */
router.get('/analytics/merchants', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { period = 'thisMonth', limit = '10' } = req.query;

    const merchants = await db.getSpendingByMerchant(userPk, {
      period: period as string,
      limit: parseInt(limit as string),
    });

    res.json({ success: true, data: merchants });
  } catch (error) {
    console.error('GET /analytics/merchants error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /analytics/budgets
 * Get user's budgets
 */
router.get('/analytics/budgets', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const budgets = await db.getBudgets(userPk);

    res.json({ success: true, data: budgets });
  } catch (error) {
    console.error('GET /analytics/budgets error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /analytics/budgets
 * Create budget
 */
router.post('/analytics/budgets', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { name, amount, period, category, merchant_id } = req.body;

    if (!name || !amount || !period) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, amount, period',
      });
    }

    const budget = await db.createBudget({
      user_pk: userPk,
      name,
      amount,
      period,
      category,
      merchant_id,
    });

    res.status(201).json({ success: true, data: budget });
  } catch (error) {
    console.error('POST /analytics/budgets error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /analytics/budgets/:budgetId
 * Delete budget
 */
router.delete('/analytics/budgets/:budgetId', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { budgetId } = req.params;

    await db.deleteBudget(userPk, budgetId);

    res.json({ success: true, message: 'Budget deleted' });
  } catch (error) {
    console.error('DELETE /analytics/budgets error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /analytics/savings-goals
 * Get savings goals
 */
router.get('/analytics/savings-goals', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const goals = await db.getSavingsGoals(userPk);

    res.json({ success: true, data: goals });
  } catch (error) {
    console.error('GET /analytics/savings-goals error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /analytics/savings-goals
 * Create savings goal
 */
router.post('/analytics/savings-goals', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { name, target_amount, target_date, image_url } = req.body;

    if (!name || !target_amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, target_amount',
      });
    }

    const goal = await db.createSavingsGoal({
      user_pk: userPk,
      name,
      target_amount,
      target_date,
      image_url,
    });

    res.status(201).json({ success: true, data: goal });
  } catch (error) {
    console.error('POST /analytics/savings-goals error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /analytics/savings-goals/:goalId/add
 * Add amount to savings goal
 */
router.post('/analytics/savings-goals/:goalId/add', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { goalId } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
      });
    }

    const goal = await db.addToSavingsGoal(userPk, goalId, amount);

    res.json({ success: true, data: goal });
  } catch (error) {
    console.error('POST /analytics/savings-goals/:id/add error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /analytics/insights
 * Get spending insights
 */
router.get('/analytics/insights', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const insights = await db.getSpendingInsights(userPk);

    res.json({ success: true, data: insights });
  } catch (error) {
    console.error('GET /analytics/insights error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ===========================================
// SUBSCRIPTION ENDPOINTS
// ===========================================

/**
 * GET /subscriptions/plans
 * Get available plans from merchant
 */
router.get('/subscriptions/plans', async (req: Request, res: Response) => {
  try {
    const { merchant_id } = req.query;

    const plans = await db.getSubscriptionPlans(merchant_id as string);

    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('GET /subscriptions/plans error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /subscriptions
 * Get user's subscriptions
 */
router.get('/subscriptions', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { status } = req.query;

    const subscriptions = await db.getUserSubscriptions(userPk, status as string);

    res.json({ success: true, data: subscriptions });
  } catch (error) {
    console.error('GET /subscriptions error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /subscriptions/:subscriptionId
 * Get single subscription
 */
router.get('/subscriptions/:subscriptionId', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { subscriptionId } = req.params;

    const subscription = await db.getSubscription(subscriptionId);

    if (!subscription || subscription.user_id !== userPk) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    res.json({ success: true, data: subscription });
  } catch (error) {
    console.error('GET /subscriptions/:id error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /subscriptions/subscribe
 * Create new subscription
 */
router.post('/subscriptions/subscribe', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { plan_id, payment_method = 'gnsWallet' } = req.body;

    if (!plan_id) {
      return res.status(400).json({ success: false, error: 'Missing plan_id' });
    }

    // Get plan details
    const plan = await db.getSubscriptionPlan(plan_id);
    if (!plan || !plan.is_active) {
      return res.status(404).json({ success: false, error: 'Plan not found or inactive' });
    }

    // Check for existing active subscription to same plan
    const existing = await db.getActiveSubscriptionForPlan(userPk, plan_id);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Already subscribed to this plan',
      });
    }

    // Create subscription
    const subscription = await db.createSubscription({
      user_pk: userPk,
      plan_id,
      merchant_id: plan.merchant_id,
      merchant_name: plan.merchant_name,
      plan_name: plan.name,
      amount: plan.price,
      currency: plan.currency,
      billing_cycle: plan.billing_cycle,
      payment_method,
      trial_days: plan.trial_days,
      next_billing_date: new Date(Date.now() + (plan.trial_days || 0) * 86400000).toISOString(),
    });

    console.log(`🔄 New subscription: ${userPk.substring(0, 8)}... → ${plan.name}`);

    res.status(201).json({
      success: true,
      data: subscription,
      message: subscription.status === 'trialing'
        ? `Trial started! Billing begins in ${plan.trial_days} days.`
        : 'Subscription activated!',
    });
  } catch (error) {
    console.error('POST /subscriptions/subscribe error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /subscriptions/:subscriptionId/cancel
 * Cancel subscription
 */
router.post('/subscriptions/:subscriptionId/cancel', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { subscriptionId } = req.params;
    const { immediately = false } = req.body;

    const subscription = await db.getSubscription(subscriptionId);

    if (!subscription || subscription.user_id !== userPk) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    if (subscription.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Already cancelled' });
    }

    const updated = await db.cancelSubscription(subscriptionId, immediately);

    console.log(`❌ Subscription cancelled: ${subscriptionId}`);

    res.json({
      success: true,
      data: updated,
      message: immediately
        ? 'Subscription cancelled immediately'
        : 'Subscription will end at period end',
    });
  } catch (error) {
    console.error('POST /subscriptions/:id/cancel error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /subscriptions/:subscriptionId/pause
 * Pause subscription
 */
router.post('/subscriptions/:subscriptionId/pause', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { subscriptionId } = req.params;

    const subscription = await db.getSubscription(subscriptionId);

    if (!subscription || subscription.user_id !== userPk) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    if (subscription.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Can only pause active subscriptions',
      });
    }

    const updated = await db.pauseSubscription(subscriptionId);

    res.json({ success: true, data: updated, message: 'Subscription paused' });
  } catch (error) {
    console.error('POST /subscriptions/:id/pause error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /subscriptions/:subscriptionId/resume
 * Resume paused subscription
 */
router.post('/subscriptions/:subscriptionId/resume', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { subscriptionId } = req.params;

    const subscription = await db.getSubscription(subscriptionId);

    if (!subscription || subscription.user_id !== userPk) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    if (subscription.status !== 'paused') {
      return res.status(400).json({
        success: false,
        error: 'Can only resume paused subscriptions',
      });
    }

    const updated = await db.resumeSubscription(subscriptionId);

    res.json({ success: true, data: updated, message: 'Subscription resumed' });
  } catch (error) {
    console.error('POST /subscriptions/:id/resume error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /subscriptions/:subscriptionId/invoices
 * Get subscription invoices
 */
router.get('/subscriptions/:subscriptionId/invoices', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { subscriptionId } = req.params;

    const subscription = await db.getSubscription(subscriptionId);

    if (!subscription || subscription.user_id !== userPk) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    const invoices = await db.getSubscriptionInvoices(subscriptionId);

    res.json({ success: true, data: invoices });
  } catch (error) {
    console.error('GET /subscriptions/:id/invoices error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /subscriptions/upcoming
 * Get upcoming renewals
 */
router.get('/subscriptions/upcoming', verifyGnsAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { days = '7' } = req.query;

    const upcoming = await db.getUpcomingRenewals(userPk, parseInt(days as string));

    res.json({ success: true, data: upcoming });
  } catch (error) {
    console.error('GET /subscriptions/upcoming error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
