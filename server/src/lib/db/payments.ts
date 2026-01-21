
import { getSupabase, generateId } from './client';
import {
  DbPaymentIntent, DbPaymentAck
} from '../../types';
import {
  DbPaymentRequest,
  SettlementInput,
  RefundInput,
  PaymentCompletionInput,
  ReceiptInput,
  RedemptionInput,
  PaymentLinkInput,
  LinkPaymentInput,
  InvoiceInput
} from '../../types/api.types';

// ===========================================
// PAYMENT INTENTS
// ===========================================
/**
 * Create a new payment intent
 */
export async function createPaymentIntent(data: {
  payment_id: string;
  from_pk: string;
  to_pk: string;
  envelope_json: any;
  payload_type: string;
  currency?: string | null;
  route_type?: string | null;
  expires_at?: string | null;
}): Promise<DbPaymentIntent> {
  const { data: result, error } = await getSupabase()
    .from('payment_intents')
    .insert({
      payment_id: data.payment_id,
      from_pk: data.from_pk.toLowerCase(),
      to_pk: data.to_pk.toLowerCase(),
      envelope_json: data.envelope_json,
      payload_type: data.payload_type,
      currency: data.currency || null,
      route_type: data.route_type || null,
      status: 'pending',
      expires_at: data.expires_at || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }

  return result as DbPaymentIntent;
}

/**
 * Get payment intent by ID
 */
export async function getPaymentIntent(paymentId: string): Promise<DbPaymentIntent | null> {
  const { data, error } = await getSupabase()
    .from('payment_intents')
    .select('*')
    .eq('payment_id', paymentId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching payment intent:', error);
    throw error;
  }

  return data as DbPaymentIntent | null;
}

/**
 * Get pending payments for a recipient
 */
export async function getPendingPayments(
  recipientPk: string,
  since?: string,
  limit: number = 50
): Promise<DbPaymentIntent[]> {
  let query = getSupabase()
    .from('payment_intents')
    .select('*')
    .eq('to_pk', recipientPk.toLowerCase())
    .in('status', ['pending', 'delivered'])
    .order('created_at', { ascending: true })
    .limit(limit);

  if (since) {
    query = query.gt('created_at', since);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching pending payments:', error);
    throw error;
  }

  return data as DbPaymentIntent[];
}

/**
 * Mark payments as delivered
 */
export async function markPaymentsDelivered(paymentIds: string[]): Promise<void> {
  const { error } = await getSupabase()
    .from('payment_intents')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
    })
    .in('payment_id', paymentIds)
    .eq('status', 'pending');

  if (error) {
    console.error('Error marking payments delivered:', error);
    throw error;
  }
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(
  paymentId: string,
  status: 'accepted' | 'rejected' | 'expired'
): Promise<void> {
  const { error } = await getSupabase()
    .from('payment_intents')
    .update({
      status: status,
      acked_at: new Date().toISOString(),
    })
    .eq('payment_id', paymentId);

  if (error) {
    console.error('Error updating payment status:', error);
    throw error;
  }
}

/**
 * Get payment history for a user
 */
export async function getPaymentHistory(
  publicKey: string,
  options: {
    direction?: 'sent' | 'received';
    status?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<DbPaymentIntent[]> {
  const { direction, status, limit = 50, offset = 0 } = options;
  const pk = publicKey.toLowerCase();

  let query = getSupabase()
    .from('payment_intents')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Filter by direction
  if (direction === 'sent') {
    query = query.eq('from_pk', pk);
  } else if (direction === 'received') {
    query = query.eq('to_pk', pk);
  } else {
    // Both sent and received
    query = query.or(`from_pk.eq.${pk},to_pk.eq.${pk}`);
  }

  // Filter by status
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching payment history:', error);
    throw error;
  }

  return data as DbPaymentIntent[];
}

/**
 * Get outgoing pending payments
 */
export async function getOutgoingPendingPayments(
  senderPk: string
): Promise<DbPaymentIntent[]> {
  const { data, error } = await getSupabase()
    .from('payment_intents')
    .select('*')
    .eq('from_pk', senderPk.toLowerCase())
    .in('status', ['pending', 'delivered'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching outgoing payments:', error);
    throw error;
  }

  return data as DbPaymentIntent[];
}

// ===========================================
// PAYMENT ACKS
// ===========================================

/**
 * Create payment acknowledgment
 */
export async function createPaymentAck(data: {
  payment_id: string;
  from_pk: string;
  status: 'accepted' | 'rejected';
  reason?: string | null;
  envelope_json?: any | null;
}): Promise<DbPaymentAck> {
  const { data: result, error } = await getSupabase()
    .from('payment_acks')
    .insert({
      payment_id: data.payment_id,
      from_pk: data.from_pk.toLowerCase(),
      status: data.status,
      reason: data.reason || null,
      envelope_json: data.envelope_json || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating payment ack:', error);
    throw error;
  }

  return result as DbPaymentAck;
}

/**
 * Get payment acknowledgment
 */
export async function getPaymentAck(paymentId: string): Promise<DbPaymentAck | null> {
  const { data, error } = await getSupabase()
    .from('payment_acks')
    .select('*')
    .eq('payment_id', paymentId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching payment ack:', error);
    throw error;
  }

  return data as DbPaymentAck | null;
}
/**
 * Expire old pending payments
 */
export async function expirePendingPayments(): Promise<number> {
  const { data, error } = await getSupabase()
    .from('payment_intents')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date().toISOString())
    .select();

  if (error) {
    console.error('Error expiring payments:', error);
    return 0;
  }

  return data?.length || 0;
}
export async function getSettlementByRequestId(requestId: string) {
  const { data, error } = await getSupabase()
    .from('gns_settlements')
    .select('*')
    .eq('request_id', requestId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getSettlementByTxHash(txHash: string) {
  const { data, error } = await getSupabase()
    .from('gns_settlements')
    .select('*')
    .eq('stellar_tx_hash', txHash)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createSettlement(settlementData: SettlementInput) {
  const { data, error } = await getSupabase()
    .from('gns_settlements')
    .insert({
      settlement_id: settlementData.settlement_id,
      request_id: settlementData.request_id,
      merchant_id: settlementData.merchant_id,
      user_pk: settlementData.user_pk.toLowerCase(),
      from_stellar_address: settlementData.from_stellar_address,
      to_stellar_address: settlementData.to_stellar_address,
      amount: settlementData.amount,
      asset_code: settlementData.asset_code,
      memo: settlementData.memo,
      order_id: settlementData.order_id,
      h3_cell: settlementData.h3_cell,
      status: settlementData.status || 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSettlementStatus(settlementId: string, status: string, txHash?: string) {
  const updateData: any = { status, updated_at: new Date().toISOString() };
  if (txHash) updateData.stellar_tx_hash = txHash;
  if (status === 'completed') updateData.completed_at = new Date().toISOString();

  const { data, error } = await getSupabase()
    .from('gns_settlements')
    .update(updateData)
    .eq('settlement_id', settlementId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSettlementComplete(settlementId: string, txHash: string) {
  return updateSettlementStatus(settlementId, 'completed', txHash);
}

export async function createPaymentCompletion(data: PaymentCompletionInput) {
  // TODO: Link to settlement if needed. Currently merchant_api passes request_id.
  if (data.transaction_hash) {
    console.log(`Payment completed for request ${data.request_id} with hash ${data.transaction_hash}`);
  }
  return { success: true };
}

// ===========================================
// RECEIPT FUNCTIONS (Sprint 5-6)
// ===========================================

export async function getReceipt(receiptId: string) {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('*')
    .eq('receipt_id', receiptId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getReceiptByTxHash(txHash: string) {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('*')
    .eq('stellar_tx_hash', txHash)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createReceipt(receiptData: ReceiptInput) {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .insert({
      ...receiptData,
      stellar_tx_hash: receiptData.stellar_tx_hash || receiptData.transaction_hash,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserReceipts(
  userPk: string,
  options?: number | { limit?: number; offset?: number; merchantId?: string; since?: string; until?: string; currency?: string }
) {
  const opts = typeof options === 'number' ? { limit: options } : (options || {});
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  let query = getSupabase()
    .from('gns_receipts')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.merchantId) query = query.eq('merchant_id', opts.merchantId);
  if (opts.since) query = query.gte('created_at', opts.since);
  if (opts.until) query = query.lte('created_at', opts.until);
  if (opts.currency) query = query.eq('currency', opts.currency);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getReceiptStats(userPk: string) {
  const { data, error } = await getSupabase()
    .from('gns_receipts')
    .select('amount, currency, merchant_id, merchant_name, created_at')
    .eq('user_pk', userPk.toLowerCase());

  if (error) throw error;

  const receipts = data || [];

  // Calculate stats
  const totalByCurrency: Record<string, number> = {};
  const merchantSpending: Record<string, { name: string; total: number; count: number }> = {};
  const monthlySpending: Record<string, number> = {};

  receipts.forEach(r => {
    const amount = parseFloat(r.amount || '0');
    const currency = r.currency || 'XLM';

    totalByCurrency[currency] = (totalByCurrency[currency] || 0) + amount;

    if (r.merchant_id) {
      if (!merchantSpending[r.merchant_id]) {
        merchantSpending[r.merchant_id] = { name: r.merchant_name || r.merchant_id, total: 0, count: 0 };
      }
      merchantSpending[r.merchant_id].total += amount;
      merchantSpending[r.merchant_id].count += 1;
    }

    const month = r.created_at?.substring(0, 7);
    if (month) {
      monthlySpending[month] = (monthlySpending[month] || 0) + amount;
    }
  });

  const topMerchants = Object.entries(merchantSpending)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([id, data]) => ({ merchant_id: id, ...data }));

  const totalAmount = Object.values(totalByCurrency).reduce((a, b) => a + b, 0);

  return {
    total_count: receipts.length,
    total_amount: totalAmount,
    totalReceipts: receipts.length,
    totalByCurrency,
    topMerchants,
    spendingByMonth: monthlySpending,
    averageTransaction: receipts.length > 0 ? totalAmount / receipts.length : 0,
  };
}

// ===========================================
// REFUND FUNCTIONS (Sprint 6)
// ===========================================

export async function getRefund(refundId: string) {
  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .select('*')
    .eq('refund_id', refundId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createRefundRequest(refundData: RefundInput) {
  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .insert({
      ...refundData,
      reason_details: refundData.reason_details || undefined,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserRefunds(
  userPk: string,
  options?: number | { status?: string; limit?: number; offset?: number }
) {
  const opts = typeof options === 'number' ? { limit: options } : (options || {});
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  let query = getSupabase()
    .from('gns_refunds')
    .select('*')
    .eq('user_pk', userPk.toLowerCase())
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status) query = query.eq('status', opts.status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getMerchantRefunds(
  merchantId: string,
  options?: number | { status?: string; limit?: number; offset?: number }
) {
  const opts = typeof options === 'number' ? { limit: options } : (options || {});
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  let query = getSupabase()
    .from('gns_refunds')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status) query = query.eq('status', opts.status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getPendingRefundForSettlement(settlementId: string) {
  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .select('*')
    .eq('settlement_id', settlementId)
    .eq('status', 'pending')
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateRefundStatus(refundId: string, status: string, txHash?: string) {
  const updateData: any = { status, updated_at: new Date().toISOString() };
  if (txHash) updateData.refund_transaction_hash = txHash;
  if (status === 'completed') updateData.processed_at = new Date().toISOString();

  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .update(updateData)
    .eq('refund_id', refundId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function completeRefund(
  refundId: string,
  details?: string | { refund_transaction_hash?: string; processed_at?: string; processed_by?: string }
) {
  const opts = typeof details === 'string' ? { refund_transaction_hash: details } : (details || {});

  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .update({
      status: 'completed',
      refund_transaction_hash: opts.refund_transaction_hash,
      processed_at: opts.processed_at || new Date().toISOString(),
      processed_by: opts.processed_by,
      updated_at: new Date().toISOString(),
    })
    .eq('refund_id', refundId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function rejectRefund(
  refundId: string,
  details?: string | { rejection_reason?: string; processed_at?: string; processed_by?: string }
) {
  const opts = typeof details === 'string' ? { rejection_reason: details } : (details || {});

  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .update({
      status: 'rejected',
      rejection_reason: opts.rejection_reason,
      processed_at: opts.processed_at || new Date().toISOString(),
      processed_by: opts.processed_by,
      updated_at: new Date().toISOString(),
    })
    .eq('refund_id', refundId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRefundStats(merchantId: string, _period?: string) {
  const { data, error } = await getSupabase()
    .from('gns_refunds')
    .select('status, refund_amount')
    .eq('merchant_id', merchantId);

  if (error) throw error;

  const refunds = data || [];
  return {
    pending: refunds.filter(r => r.status === 'pending').length,
    completed: refunds.filter(r => r.status === 'completed').length,
    rejected: refunds.filter(r => r.status === 'rejected').length,
    total_refunded: refunds
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + parseFloat(r.refund_amount || '0'), 0),
  };
}
import { getMerchantOwnerPk } from './merchants';

export async function createPaymentLink(linkData: PaymentLinkInput) {
  const effectiveOwner = linkData.owner_pk
    ?? (linkData.merchant_id ? await getMerchantOwnerPk(linkData.merchant_id) : null);

  if (!effectiveOwner) {
    throw new Error('Either owner_pk or merchant_id with valid owner required');
  }

  const { data, error } = await getSupabase()
    .from('gns_payment_links')
    .insert({
      link_id: generateId('LINK'),
      link_code: linkData.short_code || generateId('PAY').toLowerCase(),
      merchant_id: linkData.merchant_id || linkData.owner_pk, // Fallback to owner_pk if merchant_id missing
      owner_pk: linkData.owner_pk?.toLowerCase(),
      amount: linkData.amount,
      currency: linkData.currency,
      description: linkData.description,
      is_reusable: linkData.is_reusable ?? false,
      expires_at: linkData.expires_at || undefined,
      status: 'active',
      view_count: 0,
      payment_count: 0,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPaymentLinks(
  merchantId: string,
  _options?: { status?: string; limit?: number; offset?: number }
) {
  const { data, error } = await getSupabase()
    .from('gns_payment_links')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPaymentLink(linkId: string) {
  const { data, error } = await getSupabase()
    .from('gns_payment_links')
    .select('*')
    .eq('link_id', linkId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getPaymentLinkByCode(linkCode: string) {
  const { data, error } = await getSupabase()
    .from('gns_payment_links')
    .select('*')
    .eq('link_code', linkCode)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function incrementLinkViews(linkId: string) {
  try {
    await getSupabase().rpc('increment_link_views', { p_link_id: linkId });
  } catch (e) {
    console.warn('Failed to increment link views:', e);
  }
}

export async function createLinkPayment(paymentData: LinkPaymentInput) {
  const { data, error } = await getSupabase()
    .from('gns_link_payments')
    .insert({
      payment_id: generateId('LPAY'),
      link_id: paymentData.link_id,
      payer_pk: paymentData.payer_pk || paymentData.payer_public_key,
      amount: paymentData.amount,
      currency: paymentData.currency,
      stellar_tx_hash: paymentData.stellar_tx_hash,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLinkStats(linkId: string, _amount?: number) {
  // Just increment payment count
  try {
    await getSupabase().rpc('increment_link_payments', { p_link_id: linkId });
  } catch (e) {
    // Ignore error
  }
}

export async function updatePaymentLinkStatus(linkId: string, status: string) {
  const { data, error } = await getSupabase()
    .from('gns_payment_links')
    .update({ status })
    .eq('link_id', linkId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ===========================================
// SPRINT 8: INVOICE FUNCTIONS
// ===========================================

export async function createInvoice(invoiceData: InvoiceInput) {
  const effectiveOwner = invoiceData.owner_pk
    ?? (invoiceData.merchant_id ? await getMerchantOwnerPk(invoiceData.merchant_id) : null);

  if (!effectiveOwner) {
    throw new Error('Either owner_pk or merchant_id with valid owner required');
  }

  const { data, error } = await getSupabase()
    .from('gns_invoices')
    .insert({
      invoice_id: generateId('INV'),
      invoice_number: `INV-${Date.now()}`,
      merchant_id: invoiceData.merchant_id || invoiceData.owner_pk, // Fallback
      owner_pk: invoiceData.owner_pk?.toLowerCase(),
      customer_pk: invoiceData.customer_pk || invoiceData.customer_public_key,
      customer_email: invoiceData.customer_email,
      amount: invoiceData.amount,
      currency: invoiceData.currency,
      due_date: invoiceData.due_date,
      items: invoiceData.items,
      notes: invoiceData.notes,
      status: 'draft',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getInvoices(
  merchantId: string,
  _options?: { status?: string; limit?: number; offset?: number }
) {
  const { data, error } = await getSupabase()
    .from('gns_invoices')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getInvoice(invoiceId: string) {
  const { data, error } = await getSupabase()
    .from('gns_invoices')
    .select('*')
    .eq('invoice_id', invoiceId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateInvoiceStatus(invoiceId: string, status: string) {
  const { data, error } = await getSupabase()
    .from('gns_invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('invoice_id', invoiceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markInvoicePaid(invoiceId: string, merchantIdOrTxHash: string, paymentData?: { transaction_hash?: string; notes?: string }) {
  // Handle both signatures: (id, txHash) and (id, merchantId, data)
  const txHash = paymentData?.transaction_hash ?? (typeof merchantIdOrTxHash === 'string' && !paymentData ? merchantIdOrTxHash : undefined);
  const merchantId = paymentData ? merchantIdOrTxHash : undefined;

  let query = getSupabase()
    .from('gns_invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stellar_tx_hash: txHash,
      payment_notes: paymentData?.notes,
    })
    .eq('invoice_id', invoiceId);

  if (merchantId) {
    query = query.eq('merchant_id', merchantId);
  }

  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}
export async function createPaymentRequest(data: DbPaymentRequest) {
  const { data: result, error } = await getSupabase()
    .from('payment_requests')
    .insert({
      payment_id: data.payment_id,
      from_pk: data.from_pk?.toLowerCase(),
      to_pk: data.to_pk?.toLowerCase(),
      amount: data.amount,
      currency: data.currency,
      status: data.status || 'pending',
      metadata: data.metadata,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function getPaymentRequest(paymentId: string) {
  const { data, error } = await getSupabase()
    .from('payment_requests')
    .select('*')
    .eq('payment_id', paymentId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updatePaymentRequest(paymentId: string, updates: any) {
  const { data, error } = await getSupabase()
    .from('payment_requests')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('payment_id', paymentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
