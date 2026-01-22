/**
 * GNS Invoice Manager
 * 
 * Create, manage, and track invoices
 * Location: src/components/InvoiceManager.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Plus, Copy, Check, Trash2, ExternalLink, 
  Send, Calendar, DollarSign, User, Package,
  Loader2, ChevronRight, ChevronDown, RefreshCw,
  Mail, Download, Eye, Clock, CheckCircle, XCircle,
  AlertCircle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getSession } from '@gns/api-web';

// API Configuration
const API_BASE = process.env.REACT_APP_API_URL || 'https://gns-browser-production.up.railway.app';

/**
 * Invoice Manager Component
 */
const InvoiceManager = ({ darkMode = false }) => {
  // State
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [filter, setFilter] = useState('all'); // all, draft, sent, paid, overdue
  const [error, setError] = useState(null);

  // Create form state
  const [formData, setFormData] = useState({
    customerHandle: '',
    customerEmail: '',
    items: [{ description: '', quantity: 1, price: '' }],
    currency: 'EUR',
    taxRate: 22,
    dueDate: '',
    notes: ''
  });

  // Theme
  const theme = {
    bg: darkMode ? 'bg-gray-900' : 'bg-gray-50',
    bgCard: darkMode ? 'bg-gray-800' : 'bg-white',
    bgInput: darkMode ? 'bg-gray-700' : 'bg-gray-100',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textMuted: darkMode ? 'text-gray-400' : 'text-gray-600',
    border: darkMode ? 'border-gray-700' : 'border-gray-200',
    hover: darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100',
  };

  // Status colors
  const statusColors = {
    draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    sent: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    viewed: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    paid: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    overdue: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
  };

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const session = getSession();
      if (!session?.publicKey) {
        setError('Please sign in to manage invoices');
        return;
      }

      const response = await fetch(`${API_BASE}/api/invoice/list`, {
        headers: {
          'X-GNS-PublicKey': session.publicKey,
          'X-GNS-Session': session.sessionToken || '',
        }
      });

      if (!response.ok) throw new Error('Failed to fetch invoices');
      
      const data = await response.json();
      setInvoices(data.invoices || []);
      setError(null);
    } catch (err) {
      console.error('Fetch invoices error:', err);
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Calculate totals
  const calculateTotals = (items, taxRate) => {
    const subtotal = items.reduce((sum, item) => {
      const price = parseFloat(item.price) || 0;
      const qty = parseInt(item.quantity) || 0;
      return sum + (price * qty);
    }, 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  // Add item row
  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, price: '' }]
    });
  };

  // Remove item row
  const removeItem = (index) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  // Update item
  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  // Create invoice
  const handleCreate = async (e, sendImmediately = false) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const session = getSession();
      if (!session?.publicKey) throw new Error('Not authenticated');

      const { subtotal, tax, total } = calculateTotals(formData.items, formData.taxRate);

      const payload = {
        merchantId: session.publicKey,
        customerHandle: formData.customerHandle || null,
        customerEmail: formData.customerEmail || null,
        items: formData.items.filter(item => item.description && item.price),
        subtotal: subtotal.toFixed(2),
        taxRate: formData.taxRate,
        taxAmount: tax.toFixed(2),
        total: total.toFixed(2),
        currency: formData.currency,
        dueDate: formData.dueDate || null,
        notes: formData.notes || null,
        status: sendImmediately ? 'sent' : 'draft'
      };

      const response = await fetch(`${API_BASE}/api/invoice/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GNS-PublicKey': session.publicKey,
          'X-GNS-Session': session.sessionToken || '',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create invoice');
      }

      const data = await response.json();
      
      // Show the created invoice
      setSelectedInvoice(data.invoice);
      setShowCreate(false);
      
      // Reset form
      setFormData({
        customerHandle: '',
        customerEmail: '',
        items: [{ description: '', quantity: 1, price: '' }],
        currency: 'EUR',
        taxRate: 22,
        dueDate: '',
        notes: ''
      });

      // Refresh list
      fetchInvoices();
    } catch (err) {
      console.error('Create invoice error:', err);
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Send invoice
  const sendInvoice = async (invoiceId) => {
    try {
      const session = getSession();
      const response = await fetch(`${API_BASE}/api/invoice/${invoiceId}/send`, {
        method: 'PUT',
        headers: {
          'X-GNS-PublicKey': session.publicKey,
          'X-GNS-Session': session.sessionToken || '',
        }
      });

      if (!response.ok) throw new Error('Failed to send invoice');
      
      fetchInvoices();
      if (selectedInvoice?.id === invoiceId) {
        const data = await response.json();
        setSelectedInvoice(data.invoice);
      }
    } catch (err) {
      setError('Failed to send invoice');
    }
  };

  // Mark as paid
  const markAsPaid = async (invoiceId) => {
    try {
      const session = getSession();
      const response = await fetch(`${API_BASE}/api/invoice/${invoiceId}/paid`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-GNS-PublicKey': session.publicKey,
          'X-GNS-Session': session.sessionToken || '',
        },
        body: JSON.stringify({ paidAt: new Date().toISOString() })
      });

      if (!response.ok) throw new Error('Failed to mark as paid');
      
      fetchInvoices();
      setSelectedInvoice(null);
    } catch (err) {
      setError('Failed to update invoice');
    }
  };

  // Format currency
  const formatAmount = (amount, currency) => {
    const symbols = { EUR: '€', USD: '$', GBP: '£', GNS: '✦' };
    return `${symbols[currency] || currency} ${parseFloat(amount || 0).toFixed(2)}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    if (filter === 'all') return true;
    return inv.status === filter;
  });

  // Stats
  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent' || i.status === 'viewed').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    totalValue: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + parseFloat(i.total || 0), 0)
  };

  // Create Form Modal
  const CreateModal = () => {
    const { subtotal, tax, total } = calculateTotals(formData.items, formData.taxRate);

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className={`${theme.bgCard} rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto`}>
          {/* Header */}
          <div className={`p-6 border-b ${theme.border} sticky top-0 ${theme.bgCard} z-10`}>
            <h2 className={`text-xl font-bold ${theme.text}`}>Create Invoice</h2>
            <p className={`${theme.textMuted} text-sm mt-1`}>Send a professional invoice to your customer</p>
          </div>

          {/* Form */}
          <form onSubmit={(e) => handleCreate(e, false)} className="p-6 space-y-6">
            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>
                  Customer @handle
                </label>
                <div className="relative">
                  <User size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.textMuted}`} />
                  <input
                    type="text"
                    placeholder="@alice"
                    value={formData.customerHandle}
                    onChange={(e) => setFormData({ ...formData, customerHandle: e.target.value })}
                    className={`w-full pl-10 pr-4 py-3 ${theme.bgInput} ${theme.text} rounded-xl border ${theme.border} focus:border-indigo-500 outline-none`}
                  />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>
                  Customer Email
                </label>
                <div className="relative">
                  <Mail size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.textMuted}`} />
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    className={`w-full pl-10 pr-4 py-3 ${theme.bgInput} ${theme.text} rounded-xl border ${theme.border} focus:border-indigo-500 outline-none`}
                  />
                </div>
              </div>
            </div>

            {/* Items */}
            <div>
              <label className={`block text-sm font-medium ${theme.text} mb-2`}>Items</label>
              <div className={`border ${theme.border} rounded-xl overflow-hidden`}>
                {/* Header */}
                <div className={`grid grid-cols-12 gap-2 p-3 ${theme.bgInput} text-sm font-medium ${theme.textMuted}`}>
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-3 text-right">Price</div>
                  <div className="col-span-1"></div>
                </div>
                
                {/* Rows */}
                {formData.items.map((item, index) => (
                  <div key={index} className={`grid grid-cols-12 gap-2 p-3 border-t ${theme.border}`}>
                    <div className="col-span-6">
                      <input
                        type="text"
                        placeholder="Service or product"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        className={`w-full px-3 py-2 ${theme.bgInput} ${theme.text} rounded-lg border ${theme.border} focus:border-indigo-500 outline-none text-sm`}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        className={`w-full px-3 py-2 ${theme.bgInput} ${theme.text} rounded-lg border ${theme.border} focus:border-indigo-500 outline-none text-sm text-center`}
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={item.price}
                        onChange={(e) => updateItem(index, 'price', e.target.value)}
                        className={`w-full px-3 py-2 ${theme.bgInput} ${theme.text} rounded-lg border ${theme.border} focus:border-indigo-500 outline-none text-sm text-right`}
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={formData.items.length === 1}
                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded disabled:opacity-30"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Add Item */}
                <div className={`p-3 border-t ${theme.border}`}>
                  <button
                    type="button"
                    onClick={addItem}
                    className={`text-sm text-indigo-500 hover:text-indigo-600 font-medium flex items-center gap-1`}
                  >
                    <Plus size={16} />
                    Add Item
                  </button>
                </div>
              </div>
            </div>

            {/* Currency, Tax, Due Date */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className={`w-full px-4 py-3 ${theme.bgInput} ${theme.text} rounded-xl border ${theme.border} focus:border-indigo-500 outline-none`}
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="GNS">GNS (✦)</option>
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Tax Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-4 py-3 ${theme.bgInput} ${theme.text} rounded-xl border ${theme.border} focus:border-indigo-500 outline-none`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Due Date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className={`w-full px-4 py-3 ${theme.bgInput} ${theme.text} rounded-xl border ${theme.border} focus:border-indigo-500 outline-none`}
                />
              </div>
            </div>

            {/* Totals */}
            <div className={`${theme.bgInput} rounded-xl p-4 space-y-2`}>
              <div className="flex justify-between">
                <span className={theme.textMuted}>Subtotal</span>
                <span className={theme.text}>{formatAmount(subtotal, formData.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className={theme.textMuted}>Tax ({formData.taxRate}%)</span>
                <span className={theme.text}>{formatAmount(tax, formData.currency)}</span>
              </div>
              <div className={`flex justify-between pt-2 border-t ${theme.border} font-bold`}>
                <span className={theme.text}>Total</span>
                <span className="text-indigo-500 text-xl">{formatAmount(total, formData.currency)}</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={`block text-sm font-medium ${theme.text} mb-2`}>Notes (optional)</label>
              <textarea
                placeholder="Thank you for your business!"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className={`w-full px-4 py-3 ${theme.bgInput} ${theme.text} rounded-xl border ${theme.border} focus:border-indigo-500 outline-none resize-none`}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className={`px-6 py-3 ${theme.bgInput} ${theme.text} rounded-xl font-medium ${theme.hover}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || formData.items.every(i => !i.description || !i.price)}
                className={`flex-1 py-3 ${theme.bgInput} ${theme.text} rounded-xl font-medium ${theme.hover} border ${theme.border} flex items-center justify-center gap-2`}
              >
                {creating ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                Save as Draft
              </button>
              <button
                type="button"
                onClick={(e) => handleCreate(e, true)}
                disabled={creating || formData.items.every(i => !i.description || !i.price) || (!formData.customerHandle && !formData.customerEmail)}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Send Invoice
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Invoice Detail Modal
  const InvoiceDetailModal = ({ invoice }) => {
    const paymentUrl = `https://pay.gns.earth/invoice/${invoice.invoice_number}`;
    
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className={`${theme.bgCard} rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto`}>
          {/* Header */}
          <div className={`p-6 border-b ${theme.border} flex items-center justify-between`}>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-xl font-bold ${theme.text}`}>
                  Invoice #{invoice.invoice_number}
                </h2>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[invoice.status]}`}>
                  {invoice.status}
                </span>
              </div>
              <p className={`${theme.textMuted} text-sm mt-1`}>
                Created {formatDate(invoice.created_at)}
              </p>
            </div>
            <button onClick={() => setSelectedInvoice(null)} className={`p-2 ${theme.hover} rounded-full`}>
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Customer */}
            <div>
              <label className={`text-sm ${theme.textMuted}`}>Bill To</label>
              <div className={`${theme.text} font-medium`}>
                {invoice.customer_handle ? `@${invoice.customer_handle}` : invoice.customer_email || 'No customer specified'}
              </div>
            </div>

            {/* Items */}
            <div>
              <label className={`text-sm ${theme.textMuted}`}>Items</label>
              <div className={`mt-2 border ${theme.border} rounded-lg overflow-hidden`}>
                {(invoice.items || []).map((item, index) => (
                  <div key={index} className={`flex justify-between p-3 ${index > 0 ? `border-t ${theme.border}` : ''}`}>
                    <div>
                      <div className={theme.text}>{item.description}</div>
                      <div className={`text-sm ${theme.textMuted}`}>Qty: {item.quantity}</div>
                    </div>
                    <div className={`${theme.text} font-medium`}>
                      {formatAmount(item.price * item.quantity, invoice.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className={`${theme.bgInput} rounded-xl p-4 space-y-2`}>
              <div className="flex justify-between">
                <span className={theme.textMuted}>Subtotal</span>
                <span className={theme.text}>{formatAmount(invoice.subtotal, invoice.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className={theme.textMuted}>Tax ({invoice.tax_rate}%)</span>
                <span className={theme.text}>{formatAmount(invoice.tax_amount, invoice.currency)}</span>
              </div>
              <div className={`flex justify-between pt-2 border-t ${theme.border} font-bold`}>
                <span className={theme.text}>Total</span>
                <span className="text-indigo-500 text-xl">{formatAmount(invoice.total, invoice.currency)}</span>
              </div>
            </div>

            {/* Due Date */}
            {invoice.due_date && (
              <div className="flex items-center gap-2">
                <Calendar size={18} className={theme.textMuted} />
                <span className={theme.textMuted}>Due:</span>
                <span className={`${theme.text} font-medium`}>{formatDate(invoice.due_date)}</span>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div className={`${theme.bgInput} rounded-lg p-3`}>
                <p className={theme.textMuted}>{invoice.notes}</p>
              </div>
            )}

            {/* QR Code for payment */}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <div className="flex flex-col items-center pt-4">
                <div className="bg-white p-3 rounded-xl">
                  <QRCodeSVG value={paymentUrl} size={120} level="H" />
                </div>
                <p className={`${theme.textMuted} text-sm mt-2`}>Scan to pay</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {invoice.status === 'draft' && (
                <>
                  <button
                    onClick={() => sendInvoice(invoice.id)}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Send size={18} />
                    Send Invoice
                  </button>
                </>
              )}
              {(invoice.status === 'sent' || invoice.status === 'viewed' || invoice.status === 'overdue') && (
                <>
                  <button
                    onClick={() => markAsPaid(invoice.id)}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={18} />
                    Mark as Paid
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(paymentUrl);
                    }}
                    className={`px-6 py-3 ${theme.bgInput} ${theme.text} rounded-xl font-medium ${theme.hover} flex items-center gap-2`}
                  >
                    <Copy size={18} />
                    Copy Link
                  </button>
                </>
              )}
              {invoice.status === 'paid' && (
                <button
                  className={`flex-1 py-3 ${theme.bgInput} ${theme.text} rounded-xl font-medium flex items-center justify-center gap-2`}
                >
                  <Download size={18} />
                  Download PDF
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Main Render
  return (
    <div className={`h-full ${theme.bg}`}>
      {/* Header */}
      <div className={`${theme.bgCard} border-b ${theme.border} p-4`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className={`text-xl font-bold ${theme.text} flex items-center gap-2`}>
              <FileText size={24} className="text-indigo-500" />
              Invoices
            </h1>
            <p className={`${theme.textMuted} text-sm`}>Create and manage professional invoices</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchInvoices}
              className={`p-2 ${theme.bgInput} ${theme.hover} rounded-lg`}
              title="Refresh"
            >
              <RefreshCw size={18} className={theme.textMuted} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2"
            >
              <Plus size={18} />
              New Invoice
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3">
          <div className={`${theme.bgInput} rounded-lg p-3 text-center`}>
            <div className={`text-xl font-bold ${theme.text}`}>{stats.total}</div>
            <div className={`text-xs ${theme.textMuted}`}>Total</div>
          </div>
          <div className={`${theme.bgInput} rounded-lg p-3 text-center`}>
            <div className="text-xl font-bold text-gray-500">{stats.draft}</div>
            <div className={`text-xs ${theme.textMuted}`}>Drafts</div>
          </div>
          <div className={`${theme.bgInput} rounded-lg p-3 text-center`}>
            <div className="text-xl font-bold text-blue-500">{stats.sent}</div>
            <div className={`text-xs ${theme.textMuted}`}>Sent</div>
          </div>
          <div className={`${theme.bgInput} rounded-lg p-3 text-center`}>
            <div className="text-xl font-bold text-green-500">{stats.paid}</div>
            <div className={`text-xs ${theme.textMuted}`}>Paid</div>
          </div>
          <div className={`${theme.bgInput} rounded-lg p-3 text-center`}>
            <div className="text-xl font-bold text-red-500">{stats.overdue}</div>
            <div className={`text-xs ${theme.textMuted}`}>Overdue</div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mt-4">
          {['all', 'draft', 'sent', 'paid', 'overdue'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === f 
                  ? 'bg-indigo-600 text-white' 
                  : `${theme.bgInput} ${theme.text} ${theme.hover}`
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-indigo-500" />
          </div>
        ) : error ? (
          <div className={`text-center py-12 ${theme.textMuted}`}>
            <p>{error}</p>
            <button onClick={fetchInvoices} className="mt-4 text-indigo-500 hover:underline">
              Try again
            </button>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={32} className="text-indigo-500" />
            </div>
            <h3 className={`text-lg font-medium ${theme.text}`}>
              {filter === 'all' ? 'No invoices yet' : `No ${filter} invoices`}
            </h3>
            <p className={`${theme.textMuted} mt-1`}>Create your first invoice to get started</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
            >
              Create Invoice
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((invoice) => (
              <div
                key={invoice.id}
                onClick={() => setSelectedInvoice(invoice)}
                className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} ${theme.hover} cursor-pointer transition-all`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      invoice.status === 'paid' ? 'bg-green-100 dark:bg-green-900/30' :
                      invoice.status === 'overdue' ? 'bg-red-100 dark:bg-red-900/30' :
                      invoice.status === 'sent' ? 'bg-blue-100 dark:bg-blue-900/30' :
                      'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      <FileText size={20} className={
                        invoice.status === 'paid' ? 'text-green-600' :
                        invoice.status === 'overdue' ? 'text-red-600' :
                        invoice.status === 'sent' ? 'text-blue-600' :
                        'text-gray-400'
                      } />
                    </div>
                    <div>
                      <div className={`font-medium ${theme.text}`}>
                        #{invoice.invoice_number}
                      </div>
                      <div className={`text-sm ${theme.textMuted}`}>
                        {invoice.customer_handle ? `@${invoice.customer_handle}` : invoice.customer_email || 'No customer'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`font-bold ${theme.text}`}>
                        {formatAmount(invoice.total, invoice.currency)}
                      </div>
                      <div className={`text-xs ${theme.textMuted}`}>
                        {invoice.due_date ? `Due ${formatDate(invoice.due_date)}` : 'No due date'}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[invoice.status]}`}>
                      {invoice.status}
                    </span>
                    <ChevronRight size={18} className={theme.textMuted} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && <CreateModal />}
      {selectedInvoice && <InvoiceDetailModal invoice={selectedInvoice} />}
    </div>
  );
};

export default InvoiceManager;
