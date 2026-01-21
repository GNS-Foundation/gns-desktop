
import { getSupabase, generateId } from './client';
import {
  SubscriptionInput,
  QrCodeInput,
  PointTransactionInput,
  LoyaltyProfileInput,
  RedemptionInput
} from '../../types/api.types';

// ===========================================
// LOYALTY FUNCTIONS
// ===========================================
export async function getLoyaltyProfile(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_loyalty_profiles')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createLoyaltyProfile(input: LoyaltyProfileInput) {
  // Support both direct input and wrapped input if legacy calls exist (though strict type prevents this, assuming refactor covers all)
  const opts = input;

  const { data, error } = await getSupabase()
    .from('gns_loyalty_profiles')
    .insert({
      user_pk: opts.user_pk.toLowerCase(),
      total_points: opts.total_points || 0,
      available_points: opts.available_points || 0,
      lifetime_points: opts.lifetime_points || 0,
      tier: opts.tier || 'bronze',
      tier_progress: opts.tier_progress || 0,
      total_transactions: opts.total_transactions || 0,
      total_spent: opts.total_spent || 0,
      referral_code: generateId('REF'),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLoyaltyProfile(userPk: string, updates: {
  total_points?: number;
  available_points?: number;
  lifetime_points?: number;
  tier?: string;
  tier_progress?: number;
  total_transactions?: number;
  total_spent?: number;
  referred_by?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_loyalty_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_pk', userPk.toLowerCase())
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPointsHistory(
  userPk: string,
  options?: number | { type?: string; limit?: number; offset?: number }
) {
  const opts = typeof options === 'number' ? { limit: options } : (options || {});
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  let query = getSupabase()
    .from('gns_point_transactions')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.type) query = query.eq('type', opts.type);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createPointTransaction(txData: PointTransactionInput) {
  const { data, error } = await getSupabase()
    .from('gns_point_transactions')
    .insert({
      transaction_id: txData.transaction_id || generateId('PT'),
      user_pk: txData.user_pk.toLowerCase(),
      points: txData.points,
      type: txData.type,
      description: txData.description,
      reference_id: txData.reference_id,
      merchant_id: txData.merchant_id,
      merchant_name: txData.merchant_name,
      balance_after: txData.balance_after,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserAchievements(
  userPk: string,
  _options?: { limit?: number; unlocked?: boolean }
) {
  const { data, error } = await getSupabase()
    .from('gns_user_achievements')
    .select('*, achievement:gns_achievements(*)')
    .eq('user_pk', userPk.toLowerCase());

  if (error) throw error;
  return data || [];
}

export async function getAvailableRewards(options?: string | {
  merchantId?: string;
  category?: string;
  maxPoints?: number;
  limit?: number;
}) {
  const opts = typeof options === 'string' ? { merchantId: options } : (options || {});

  let query = getSupabase()
    .from('gns_rewards')
    .select('*')
    .eq('is_available', true)
    .order('points_cost', { ascending: true });

  if (opts.merchantId) query = query.eq('merchant_id', opts.merchantId);
  if (opts.maxPoints) query = query.lte('points_cost', opts.maxPoints);
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getReward(rewardId: string) {
  const { data, error } = await getSupabase()
    .from('gns_rewards')
    .select('*')
    .eq('reward_id', rewardId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateReward(rewardId: string, updates: any) {
  const { data, error } = await getSupabase()
    .from('gns_rewards')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('reward_id', rewardId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createRedemption(redemptionData: RedemptionInput) {
  const { data, error } = await getSupabase()
    .from('gns_redemptions')
    .insert({
      redemption_id: redemptionData.redemption_id || generateId('RDM'),
      reward_id: redemptionData.reward_id,
      reward_name: redemptionData.reward_name,
      user_pk: redemptionData.user_pk.toLowerCase(),
      points_spent: redemptionData.points_spent,
      merchant_id: redemptionData.merchant_id,
      expires_at: redemptionData.expires_at,
      coupon_code: generateId('CPN'),
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserRedemptions(
  userPk: string,
  options?: number | { unused?: boolean; limit?: number }
) {
  const opts = typeof options === 'number' ? { limit: options } : (options || {});
  const limit = opts.limit || 50;

  let query = getSupabase()
    .from('gns_redemptions')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (opts.unused !== undefined) {
    query = query.eq('is_used', !opts.unused);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getLoyaltyPrograms(options?: string | {
  userPk?: string;
  enrolled?: boolean;
}) {
  const opts = typeof options === 'string' ? { userPk: options } : (options || {});

  let query = getSupabase()
    .from('gns_loyalty_programs')
    .select('*')
    .eq('is_active', true);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getLoyaltyProgram(programId: string) {
  const { data, error } = await getSupabase()
    .from('gns_loyalty_programs')
    .select('*')
    .eq('program_id', programId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getUserProgramEnrollment(userPk: string, programId: string) {
  const { data, error } = await getSupabase()
    .from('gns_program_enrollments')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .eq('program_id', programId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createProgramEnrollment(enrollmentData: {
  user_pk: string;
  program_id: string;
  merchant_id?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_program_enrollments')
    .insert({
      user_pk: enrollmentData.user_pk.toLowerCase(),
      program_id: enrollmentData.program_id,
      enrolled_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function findUserByReferralCode(referralCode: string) {
  const { data, error } = await getSupabase()
    .from('gns_loyalty_profiles')
    .select('*')
    .eq('referral_code', referralCode)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}
export async function registerDevice(deviceData: {
  user_pk: string;
  device_id: string;
  push_token: string;
  platform: string;
  device_name?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_devices')
    .upsert({
      ...deviceData,
      user_pk: deviceData.user_pk.toLowerCase(),
      is_active: true,
      registered_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
    }, { onConflict: 'user_pk,device_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unregisterDevice(userPk: string, deviceId: string) {
  const { error } = await getSupabase()
    .from('gns_devices')
    .update({ is_active: false })
    .eq('user_pk', userPk.toLowerCase())
    .eq('device_id', deviceId);

  if (error) throw error;
}

export async function getNotificationPreferences(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_notification_preferences')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertNotificationPreferences(userPk: string, prefs: any) {
  const { data, error } = await getSupabase()
    .from('gns_notification_preferences')
    .upsert({
      user_pk: userPk.toLowerCase(),
      ...prefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_pk' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getNotifications(
  userPk: string,
  options?: number | { limit?: number; offset?: number; unreadOnly?: boolean }
) {
  const opts = typeof options === 'number' ? { limit: options } : (options || {});
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  let query = getSupabase()
    .from('gns_notifications')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getUnreadNotificationCount(userPk: string) {
  const { count, error } = await getSupabase()
    .from('gns_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_pk', userPk.toLowerCase())
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

export async function markNotificationRead(userPkOrNotificationId: string, notificationId?: string) {
  const nId = notificationId || userPkOrNotificationId;

  const { error } = await getSupabase()
    .from('gns_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('notification_id', nId);

  if (error) throw error;
}

export async function markAllNotificationsRead(userPk: string) {
  const { error } = await getSupabase()
    .from('gns_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_pk', userPk.toLowerCase())
    .eq('is_read', false);

  if (error) throw error;
}
export async function getSpendingSummary(
  userPk: string,
  options?: string | { period?: string; startDate?: string; endDate?: string }
) {
  const opts = typeof options === 'string' ? { period: options } : (options || {});

  let query = getSupabase()
    .from('gns_receipts')
    .select('amount, currency, created_at, merchant_name')
    .eq('user_pk', userPk.toLowerCase());

  if (opts.startDate) query = query.gte('created_at', opts.startDate);
  if (opts.endDate) query = query.lte('created_at', opts.endDate);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  const receipts = data || [];
  const total = receipts.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);

  return {
    total_spent: total,
    transaction_count: receipts.length,
    receipts,
  };
}

export async function getDailySpending(userPk: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('amount, created_at')
    .eq('user_pk', userPk.toLowerCase())
    .gte('created_at', since);

  if (error) throw error;
  return data || [];
}

export async function getSpendingByCategory(userPk: string, _period?: string) {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('amount, category')
    .eq('user_pk', userPk.toLowerCase());

  if (error) throw error;
  return data || [];
}

export async function getSpendingByMerchant(
  userPk: string,
  options?: number | { period?: string; limit?: number }
) {
  const opts = typeof options === 'number' ? { limit: options } : (options || {});

  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('amount, merchant_id, merchant_name')
    .eq('user_pk', userPk.toLowerCase());

  if (error) throw error;
  return data || [];
}

export async function getBudgets(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_budgets')
    .select('*')
    .eq('user_pk', userPk.toLowerCase());

  if (error) throw error;
  return data || [];
}

export async function createBudget(budgetData: {
  user_pk: string;
  name: string;
  amount: number;
  period: string;
  category?: string;
  merchant_id?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_budgets')
    .insert({
      budget_id: generateId('BDG'),
      user_pk: budgetData.user_pk.toLowerCase(),
      name: budgetData.name,
      amount: budgetData.amount,
      period: budgetData.period,
      category: budgetData.category,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBudget(userPkOrBudgetId: string, budgetId?: string) {
  const bId = budgetId || userPkOrBudgetId;

  const { error } = await getSupabase()
    .from('gns_budgets')
    .delete()
    .eq('budget_id', bId);

  if (error) throw error;
}

export async function getSavingsGoals(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_savings_goals')
    .select('*')
    .eq('user_pk', userPk.toLowerCase());

  if (error) throw error;
  return data || [];
}

export async function createSavingsGoal(goalData: {
  user_pk: string;
  name: string;
  target_amount: number;
  target_date?: string;
  image_url?: string;
}) {
  const { data, error } = await getSupabase()
    .from('gns_savings_goals')
    .insert({
      goal_id: generateId('GOAL'),
      user_pk: goalData.user_pk.toLowerCase(),
      name: goalData.name,
      target_amount: goalData.target_amount,
      target_date: goalData.target_date,
      current_amount: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function addToSavingsGoal(userPk: string, goalId: string, amount?: number) {
  // If only 2 args, treat as (goalId, amount)
  if (amount === undefined && typeof goalId === 'number') {
    amount = goalId as any;
    goalId = userPk;
    userPk = ''; // unused in current impl
  }

  if (amount === undefined) {
    // Just return the goal
    const { data, error } = await getSupabase()
      .from('gns_savings_goals')
      .select('*')
      .eq('goal_id', goalId)
      .single();
    if (error) throw error;
    return data;
  }

  // First get current amount
  const { data: goal } = await getSupabase()
    .from('gns_savings_goals')
    .select('current_amount')
    .eq('goal_id', goalId)
    .single();

  const newAmount = (goal?.current_amount || 0) + amount;

  const { data, error } = await getSupabase()
    .from('gns_savings_goals')
    .update({ current_amount: newAmount })
    .eq('goal_id', goalId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSpendingInsights(userPk: string) {
  return {
    top_category: 'Food & Dining',
    monthly_average: 0,
    trend: 'stable',
    suggestions: [],
  };
}

// ===========================================
// SPRINT 7: SUBSCRIPTION FUNCTIONS
// ===========================================

export async function getSubscriptionPlans(merchantId?: string) {
  let query = getSupabase()
    .from('gns_subscription_plans')
    .select('*')
    .eq('is_active', true);

  if (merchantId) {
    query = query.eq('merchant_id', merchantId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getSubscriptionPlan(planId: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscription_plans')
    .select('*')
    .eq('plan_id', planId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getUserSubscriptions(userPk: string, _status?: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .select('*, plan:gns_subscription_plans(*)')
    .eq('user_pk', userPk.toLowerCase());

  if (error) throw error;
  return data || [];
}

export async function getSubscription(subscriptionId: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .select('*, plan:gns_subscription_plans(*)')
    .eq('subscription_id', subscriptionId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getActiveSubscriptionForPlan(userPk: string, planId: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .eq('plan_id', planId)
    .eq('status', 'active')
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createSubscription(subData: SubscriptionInput) {
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .insert({
      subscription_id: generateId('SUB'),
      user_pk: subData.user_pk.toLowerCase(),
      plan_id: subData.plan_id,
      amount: subData.amount,
      currency: subData.currency,
      billing_cycle: subData.billing_cycle,
      next_billing_date: subData.next_billing_date,
      status: 'active',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function cancelSubscription(subscriptionId: string, _immediately?: boolean) {
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('subscription_id', subscriptionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function pauseSubscription(subscriptionId: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString(),
    })
    .eq('subscription_id', subscriptionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function resumeSubscription(subscriptionId: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .update({
      status: 'active',
      paused_at: null,
    })
    .eq('subscription_id', subscriptionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSubscriptionInvoices(subscriptionId: string) {
  const { data, error } = await getSupabase()
    .from('gns_subscription_invoices')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getUpcomingRenewals(userPk: string, days = 7) {
  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await getSupabase()
    .from('gns_subscriptions')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .eq('status', 'active')
    .lte('next_billing_date', futureDate);

  if (error) throw error;
  return data || [];
}

// ===========================================
// SPRINT 8: MULTI-CURRENCY FUNCTIONS
// ===========================================

export async function getSupportedAssets() {
  const { data, error } = await getSupabase()
    .from('gns_assets')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;
  return data || [];
}

export async function getCurrencyPreferences(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_currency_preferences')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertCurrencyPreferences(userPk: string, prefs: any) {
  const { data, error } = await getSupabase()
    .from('gns_currency_preferences')
    .upsert({
      user_pk: userPk.toLowerCase(),
      ...prefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_pk' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getExchangeRate(fromCurrency: string, toCurrency: string) {
  const { data, error } = await getSupabase()
    .from('gns_exchange_rates')
    .select('*')
    .eq('from_currency', fromCurrency)
    .eq('to_currency', toCurrency)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getAllExchangeRates() {
  const { data, error } = await getSupabase()
    .from('gns_exchange_rates')
    .select('*');

  if (error) throw error;
  return data || [];
}
import { getMerchantOwnerPk } from './merchants';

export async function createQrCode(qrData: QrCodeInput) {
  const effectiveOwner = qrData.owner_pk
    ?? (qrData.merchant_id ? await getMerchantOwnerPk(qrData.merchant_id) : null);

  if (!effectiveOwner) {
    throw new Error('Either owner_pk or merchant_id with valid owner required');
  }

  const { data, error } = await getSupabase()
    .from('gns_qr_codes')
    .insert({
      qr_id: generateId('QR'),
      user_pk: qrData.user_pk?.toLowerCase(),
      owner_pk: qrData.owner_pk?.toLowerCase(),
      merchant_id: qrData.merchant_id || qrData.owner_pk,
      type: qrData.type,
      amount: qrData.amount,
      currency: qrData.currency,
      data: qrData.data,
      is_active: true,
      scan_count: 0,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getQrCode(qrId: string) {
  const { data, error } = await getSupabase()
    .from('gns_qr_codes')
    .select('*')
    .eq('qr_id', qrId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getUserQrCodes(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_qr_codes')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .eq('is_active', true);

  if (error) throw error;
  return data || [];
}

export async function deactivateQrCode(qrId: string, userPk?: string) {
  let query = getSupabase()
    .from('gns_qr_codes')
    .update({ is_active: false })
    .eq('qr_id', qrId);

  if (userPk) {
    query = query.eq('user_pk', userPk.toLowerCase());
  }

  const { error } = await query;
  if (error) throw error;
}

