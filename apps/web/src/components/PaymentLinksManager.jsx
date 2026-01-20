/**
 * GNS Payment Links Manager
 * 
 * Create, manage, and share payment links
 * Location: src/components/PaymentLinksManager.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Link2, Plus, Copy, Check, Trash2, ExternalLink, 
  QrCode, Share2, Eye, EyeOff, Calendar, DollarSign,
  Loader2, ChevronRight, MoreVertical, RefreshCw,
  Mail, MessageCircle, Twitter, Download
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getSession } from './auth';

// API Configuration
const API_BASE = process.env.REACT_APP_API_URL || 'https://superb-adaptation-production.up.railway.app';

/**
 * Payment Links Manager Component
 */
const PaymentLinksManager = ({ darkMode = false, onClose }) => {
  // State
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLink, setSelectedLink] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError] = useState(null);

  // Create form state
  const [formData, setFormData] = useState({
    type: 'oneTime',
    amount: '',
    currency: 'EUR',
    title: '',
    description: '',
    expiresIn: '7', // days, empty = never
    allowCustomAmount: false
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

  // Fetch payment links
  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true);
      const session = getSession();
      if (!session?.publicKey) {
        setError('Please sign in to manage payment links');
        return;
      }

      const response = await fetch(`${API_BASE}/api/link/list`, {
        headers: {
          'X-GNS-PublicKey': session.publicKey,
          'X-GNS-Session': session.sessionToken || '',
        }
      });

      if (!response.ok) throw new Error('Failed to fetch links');
      
      const data = await response.json();
      setLinks(data.links || []);
      setError(null);
    } catch (err) {
      console.error('Fetch links error:', err);
      setError('Failed to load payment links');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  // Create payment link
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const session = getSession();
      if (!session?.publicKey) throw new Error('Not authenticated');

      const payload = {
        merchantId: session.publicKey,
        amount: formData.allowCustomAmount ? null : formData.amount,
        currency: formData.currency,
        title: formData.title || 'Payment',
        description: formData.description,
        type: formData.type,
        expiresAt: formData.expiresIn 
          ? new Date(Date.now() + parseInt(formData.expiresIn) * 24 * 60 * 60 * 1000).toISOString()
          : null
      };

      const response = await fetch(`${API_BASE}/api/link/create`, {
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
        throw new Error(err.error || 'Failed to create link');
      }

      const data = await response.json();
      
      // Show the created link
      setSelectedLink(data.link);
      setShowCreate(false);
      
      // Reset form
      setFormData({
        type: 'oneTime',
        amount: '',
        currency: 'EUR',
        title: '',
        description: '',
        expiresIn: '7',
        allowCustomAmount: false
      });

      // Refresh list
      fetchLinks();
    } catch (err) {
      console.error('Create link error:', err);
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Copy link to clipboard
  const copyLink = async (link) => {
    const url = `https://pay.gns.earth/p/${link.code}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Deactivate link
  const deactivateLink = async (linkId) => {
    if (!confirm('Deactivate this payment link?')) return;

    try {
      const session = getSession();
      const response = await fetch(`${API_BASE}/api/link/${linkId}/deactivate`, {
        method: 'PUT',
        headers: {
          'X-GNS-PublicKey': session.publicKey,
          'X-GNS-Session': session.sessionToken || '',
        }
      });

      if (!response.ok) throw new Error('Failed to deactivate');
      
      fetchLinks();
      if (selectedLink?.id === linkId) setSelectedLink(null);
    } catch (err) {
      setError('Failed to deactivate link');
    }
  };

  // Share link
  const shareLink = async (link, method) => {
    const url = `https://pay.gns.earth/p/${link.code}`;
    const text = `Pay ${link.amount ? `${link.currency} ${link.amount}` : ''} via GNS: ${link.title || 'Payment'}`;

    switch (method) {
      case 'email':
        window.open(`mailto:?subject=${encodeURIComponent(link.title || 'Payment Request')}&body=${encodeURIComponent(text + '\n\n' + url)}`);
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
        break;
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`);
        break;
      case 'native':
        if (navigator.share) {
          await navigator.share({ title: link.title, text, url });
        }
        break;
      default:
        copyLink(link);
    }
  };

  // Format currency
  const formatAmount = (amount, currency) => {
    if (!amount) return 'Any amount';
    const symbols = { EUR: '€', USD: '$', GBP: '£', GNS: '✦' };
    return `${symbols[currency] || currency} ${parseFloat(amount).toFixed(2)}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Create Form Modal
  const CreateModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${theme.bgCard} rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-auto`}>
        {/* Header */}
        <div className={`p-6 border-b ${theme.border}`}>
          <h2 className={`text-xl font-bold ${theme.text}`}>Create Payment Link</h2>
          <p className={`${theme.textMuted} text-sm mt-1`}>Generate a shareable link to receive payments</p>
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} className="p-6 space-y-5">
          {/* Link Type */}
          <div>
            <label className={`block text-sm font-medium ${theme.text} mb-2`}>Link Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'oneTime' })}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  formData.type === 'oneTime' 
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' 
                    : `${theme.border} ${theme.hover}`
                }`}
              >
                <div className={`font-medium ${theme.text}`}>One-time</div>
                <div className={`text-xs ${theme.textMuted}`}>Single use only</div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'reusable' })}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  formData.type === 'reusable' 
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' 
                    : `${theme.border} ${theme.hover}`
                }`}
              >
                <div className={`font-medium ${theme.text}`}>Reusable</div>
                <div className={`text-xs ${theme.textMuted}`}>Multiple payments</div>
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className={`block text-sm font-medium ${theme.text} mb-2`}>Amount</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <DollarSign size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.textMuted}`} />
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  disabled={formData.allowCustomAmount}
                  className={`w-full pl-10 pr-4 py-3 ${theme.bgInput} ${theme.text} rounded-xl border ${theme.border} focus:border-indigo-500 outline-none disabled:opacity-50`}
                />
              </div>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className={`px-4 py-3 ${theme.bgInput} ${theme.text} rounded-xl border ${theme.border} focus:border-indigo-500 outline-none`}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="GNS">GNS</option>
              </select>
            </div>
            <label className={`flex items-center gap-2 mt-2 ${theme.textMuted} text-sm cursor-pointer`}>
              <input
                type="checkbox"
                checked={formData.allowCustomAmount}
                onChange={(e) => setFormData({ ...formData, allowCustomAmount: e.target.checked, amount: '' })}
                className="rounded border-gray-300"
              />
              Let customer choose amount
            </label>
          </div>

          {/* Title */}
          <div>
            <label className={`block text-sm font-medium ${theme.text} mb-2`}>Title</label>
            <input
              type="text"
              placeholder="e.g., Invoice #1234"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={`w-full px-4 py-3 ${theme.bgInput} ${theme.text} rounded-xl border ${theme.border} focus:border-indigo-500 outline-none`}
            />
          </div>

          {/* Description */}
          <div>
            <label className={`block text-sm font-medium ${theme.text} mb-2`}>Description (optional)</label>
            <textarea
              placeholder="What is this payment for?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className={`w-full px-4 py-3 ${theme.bgInput} ${theme.text} rounded-xl border ${theme.border} focus:border-indigo-500 outline-none resize-none`}
            />
          </div>

          {/* Expiration */}
          <div>
            <label className={`block text-sm font-medium ${theme.text} mb-2`}>Expiration</label>
            <select
              value={formData.expiresIn}
              onChange={(e) => setFormData({ ...formData, expiresIn: e.target.value })}
              className={`w-full px-4 py-3 ${theme.bgInput} ${theme.text} rounded-xl border ${theme.border} focus:border-indigo-500 outline-none`}
            >
              <option value="">Never expires</option>
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
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
              className={`flex-1 py-3 ${theme.bgInput} ${theme.text} rounded-xl font-medium ${theme.hover}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || (!formData.allowCustomAmount && !formData.amount)}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-xl font-medium flex items-center justify-center gap-2"
            >
              {creating ? <Loader2 size={18} className="animate-spin" /> : <Link2 size={18} />}
              Create Link
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Link Detail Modal
  const LinkDetailModal = ({ link }) => {
    const url = `https://pay.gns.earth/p/${link.code}`;
    
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className={`${theme.bgCard} rounded-2xl shadow-2xl w-full max-w-md`}>
          {/* Header */}
          <div className={`p-6 border-b ${theme.border} flex items-center justify-between`}>
            <div>
              <h2 className={`text-xl font-bold ${theme.text}`}>
                {link.status === 'active' ? '✓' : '○'} {link.title || 'Payment Link'}
              </h2>
              <p className={`${theme.textMuted} text-sm mt-1`}>
                {link.type === 'oneTime' ? 'One-time' : 'Reusable'} • Created {formatDate(link.created_at)}
              </p>
            </div>
            <button onClick={() => setSelectedLink(null)} className={`p-2 ${theme.hover} rounded-full`}>
              ✕
            </button>
          </div>

          {/* QR Code */}
          <div className="p-6 flex flex-col items-center">
            <div className="bg-white p-4 rounded-2xl shadow-lg">
              <QRCodeSVG 
                value={url} 
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>
            
            <div className={`mt-4 text-2xl font-bold ${theme.text}`}>
              {formatAmount(link.amount, link.currency)}
            </div>

            {link.description && (
              <p className={`${theme.textMuted} text-center mt-2`}>{link.description}</p>
            )}
          </div>

          {/* Link URL */}
          <div className={`mx-6 p-3 ${theme.bgInput} rounded-xl flex items-center gap-2`}>
            <input
              type="text"
              value={url}
              readOnly
              className={`flex-1 bg-transparent ${theme.text} text-sm outline-none`}
            />
            <button
              onClick={() => copyLink(link)}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              {copiedId === link.id ? (
                <Check size={18} className="text-green-500" />
              ) : (
                <Copy size={18} className={theme.textMuted} />
              )}
            </button>
          </div>

          {/* Share Options */}
          <div className="p-6 space-y-4">
            <p className={`text-sm font-medium ${theme.text}`}>Share via</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => shareLink(link, 'email')}
                className={`p-3 ${theme.bgInput} ${theme.hover} rounded-xl`}
                title="Email"
              >
                <Mail size={20} className={theme.textMuted} />
              </button>
              <button
                onClick={() => shareLink(link, 'whatsapp')}
                className={`p-3 ${theme.bgInput} ${theme.hover} rounded-xl`}
                title="WhatsApp"
              >
                <MessageCircle size={20} className={theme.textMuted} />
              </button>
              <button
                onClick={() => shareLink(link, 'twitter')}
                className={`p-3 ${theme.bgInput} ${theme.hover} rounded-xl`}
                title="Twitter"
              >
                <Twitter size={20} className={theme.textMuted} />
              </button>
              <button
                onClick={() => shareLink(link, 'native')}
                className={`p-3 ${theme.bgInput} ${theme.hover} rounded-xl`}
                title="More"
              >
                <Share2 size={20} className={theme.textMuted} />
              </button>
            </div>

            {/* Stats */}
            <div className={`grid grid-cols-3 gap-3 pt-4 border-t ${theme.border}`}>
              <div className="text-center">
                <div className={`text-xl font-bold ${theme.text}`}>{link.view_count || 0}</div>
                <div className={`text-xs ${theme.textMuted}`}>Views</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold ${theme.text}`}>{link.payment_count || 0}</div>
                <div className={`text-xs ${theme.textMuted}`}>Payments</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold ${theme.text}`}>
                  {link.status === 'active' ? '🟢' : '⚪'}
                </div>
                <div className={`text-xs ${theme.textMuted}`}>{link.status}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => window.open(url, '_blank')}
                className={`flex-1 py-3 ${theme.bgInput} ${theme.text} rounded-xl font-medium ${theme.hover} flex items-center justify-center gap-2`}
              >
                <ExternalLink size={16} />
                Open
              </button>
              {link.status === 'active' && (
                <button
                  onClick={() => deactivateLink(link.id)}
                  className="flex-1 py-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center justify-center gap-2"
                >
                  <EyeOff size={16} />
                  Deactivate
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
      <div className={`${theme.bgCard} border-b ${theme.border} p-4 flex items-center justify-between`}>
        <div>
          <h1 className={`text-xl font-bold ${theme.text} flex items-center gap-2`}>
            <Link2 size={24} className="text-indigo-500" />
            Payment Links
          </h1>
          <p className={`${theme.textMuted} text-sm`}>Create shareable links to receive payments</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchLinks}
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
            New Link
          </button>
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
            <button onClick={fetchLinks} className="mt-4 text-indigo-500 hover:underline">
              Try again
            </button>
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Link2 size={32} className="text-indigo-500" />
            </div>
            <h3 className={`text-lg font-medium ${theme.text}`}>No payment links yet</h3>
            <p className={`${theme.textMuted} mt-1`}>Create your first link to start receiving payments</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
            >
              Create Payment Link
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <div
                key={link.id}
                onClick={() => setSelectedLink(link)}
                className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} ${theme.hover} cursor-pointer transition-all`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${
                      link.status === 'active' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'
                    } flex items-center justify-center`}>
                      <Link2 size={20} className={link.status === 'active' ? 'text-green-600' : 'text-gray-400'} />
                    </div>
                    <div>
                      <div className={`font-medium ${theme.text}`}>{link.title || 'Payment Link'}</div>
                      <div className={`text-sm ${theme.textMuted}`}>
                        {formatAmount(link.amount, link.currency)} • {link.type === 'oneTime' ? 'One-time' : 'Reusable'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`text-sm ${theme.text}`}>{link.payment_count || 0} payments</div>
                      <div className={`text-xs ${theme.textMuted}`}>{link.view_count || 0} views</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyLink(link); }}
                      className={`p-2 ${theme.hover} rounded-lg`}
                    >
                      {copiedId === link.id ? (
                        <Check size={18} className="text-green-500" />
                      ) : (
                        <Copy size={18} className={theme.textMuted} />
                      )}
                    </button>
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
      {selectedLink && <LinkDetailModal link={selectedLink} />}
    </div>
  );
};

export default PaymentLinksManager;
