/**
 * GNS QR Code Manager
 * 
 * Generate and manage payment QR codes
 * Location: src/components/QRCodeManager.jsx
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  QrCode, Plus, Copy, Check, Trash2, Download,
  DollarSign, Edit2, Eye, Share2,
  Loader2, RefreshCw, Printer
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getSession } from './auth';

// API Configuration
const API_BASE = process.env.REACT_APP_API_URL || 'https://superb-adaptation-production.up.railway.app';

/**
 * QR Code Manager Component
 */
const QRCodeManager = ({ darkMode = false }) => {
  // State
  const [qrCodes, setQrCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedQR, setSelectedQR] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError] = useState(null);

  // Create form state
  const [formData, setFormData] = useState({
    amount: '',
    currency: 'EUR',
    label: '',
    reference: '',
    fixedAmount: false
  });

  // Ref for download
  const qrRef = useRef(null);

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

  // Fetch QR codes
  const fetchQRCodes = useCallback(async () => {
    try {
      setLoading(true);
      const session = getSession();
      if (!session?.publicKey) {
        setError('Please sign in to manage QR codes');
        return;
      }

      const response = await fetch(`${API_BASE}/api/qr/list`, {
        headers: {
          'X-GNS-PublicKey': session.publicKey,
          'X-GNS-Session': session.sessionToken || '',
        }
      });

      if (!response.ok) throw new Error('Failed to fetch QR codes');
      
      const data = await response.json();
      setQrCodes(data.qrCodes || []);
      setError(null);
    } catch (err) {
      console.error('Fetch QR codes error:', err);
      setError('Failed to load QR codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQRCodes();
  }, [fetchQRCodes]);

  // Create QR code
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const session = getSession();
      if (!session?.publicKey) throw new Error('Not authenticated');

      const payload = {
        userPk: session.publicKey,
        amount: formData.fixedAmount && formData.amount ? formData.amount : null,
        currency: formData.currency,
        label: formData.label || null,
        reference: formData.reference || null,
        type: formData.fixedAmount ? 'fixed' : 'dynamic'
      };

      const response = await fetch(`${API_BASE}/api/qr/create`, {
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
        throw new Error(err.error || 'Failed to create QR code');
      }

      const data = await response.json();
      
      // Show the created QR
      setSelectedQR(data.qrCode);
      setShowCreate(false);
      
      // Reset form
      setFormData({
        amount: '',
        currency: 'EUR',
        label: '',
        reference: '',
        fixedAmount: false
      });

      // Refresh list
      fetchQRCodes();
    } catch (err) {
      console.error('Create QR code error:', err);
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Delete QR code
  const deleteQRCode = async (qrId) => {
    if (!confirm('Deactivate this QR code?')) return;

    try {
      const session = getSession();
      const response = await fetch(`${API_BASE}/api/qr/${qrId}`, {
        method: 'DELETE',
        headers: {
          'X-GNS-PublicKey': session.publicKey,
          'X-GNS-Session': session.sessionToken || '',
        }
      });

      if (!response.ok) throw new Error('Failed to delete QR code');
      
      fetchQRCodes();
      if (selectedQR?.id === qrId) setSelectedQR(null);
    } catch (err) {
      setError('Failed to delete QR code');
    }
  };

  // Generate QR data URL
  const getQRDataUrl = (qr) => {
    const session = getSession();
    const handle = session?.handle || session?.publicKey?.slice(0, 8);
    
    // GNS Payment URI scheme
    const params = new URLSearchParams();
    params.set('to', session?.publicKey || '');
    if (qr.amount) params.set('amount', qr.amount);
    if (qr.currency) params.set('currency', qr.currency);
    if (qr.label) params.set('label', qr.label);
    if (qr.reference) params.set('ref', qr.reference);
    
    return `gns://pay?${params.toString()}`;
  };

  // Download QR as PNG
  const downloadQR = (qr) => {
    const canvas = document.createElement('canvas');
    const svg = document.querySelector(`#qr-${qr.id} svg`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      
      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 400, 400);
      
      // Draw QR
      ctx.drawImage(img, 50, 50, 300, 300);
      
      // Add label
      if (qr.label) {
        ctx.fillStyle = 'black';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(qr.label, 200, 380);
      }
      
      // Download
      const link = document.createElement('a');
      link.download = `gns-qr-${qr.label || qr.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Copy payment link
  const copyLink = async (qr) => {
    const session = getSession();
    const handle = session?.handle;
    const url = handle 
      ? `https://pay.gns.earth/@${handle}${qr.amount ? `?amount=${qr.amount}&currency=${qr.currency}` : ''}`
      : getQRDataUrl(qr);
    
    await navigator.clipboard.writeText(url);
    setCopiedId(qr.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Format amount
  const formatAmount = (amount, currency) => {
    if (!amount) return 'Any amount';
    const symbols = { EUR: '€', USD: '$', GBP: '£', GNS: '✦' };
    return `${symbols[currency] || currency} ${parseFloat(amount).toFixed(2)}`;
  };

  // Create Form Modal
  const CreateModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${theme.bgCard} rounded-2xl shadow-2xl w-full max-w-md`}>
        {/* Header */}
        <div className={`p-6 border-b ${theme.border}`}>
          <h2 className={`text-xl font-bold ${theme.text}`}>Create QR Code</h2>
          <p className={`${theme.textMuted} text-sm mt-1`}>Generate a QR code for receiving payments</p>
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} className="p-6 space-y-5">
          {/* Label */}
          <div>
            <label className={`block text-sm font-medium ${theme.text} mb-2`}>Label</label>
            <input
              type="text"
              placeholder="e.g., Tip Jar, Coffee Fund"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className={`w-full px-4 py-3 ${theme.bgInput} ${theme.text} rounded-xl border ${theme.border} focus:border-indigo-500 outline-none`}
            />
          </div>

          {/* Fixed Amount Toggle */}
          <div>
            <label className={`flex items-center gap-3 cursor-pointer`}>
              <div className={`relative w-12 h-6 rounded-full transition-colors ${formData.fixedAmount ? 'bg-indigo-600' : theme.bgInput}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.fixedAmount ? 'left-7' : 'left-1'}`} />
              </div>
              <span className={theme.text}>Fixed amount</span>
            </label>
          </div>

          {/* Amount (if fixed) */}
          {formData.fixedAmount && (
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
                    className={`w-full pl-10 pr-4 py-3 ${theme.bgInput} ${theme.text} rounded-xl border ${theme.border} focus:border-indigo-500 outline-none`}
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
            </div>
          )}

          {/* Reference (optional) */}
          <div>
            <label className={`block text-sm font-medium ${theme.text} mb-2`}>Reference (optional)</label>
            <input
              type="text"
              placeholder="Order #, Invoice #, etc."
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              className={`w-full px-4 py-3 ${theme.bgInput} ${theme.text} rounded-xl border ${theme.border} focus:border-indigo-500 outline-none`}
            />
            <p className={`text-xs ${theme.textMuted} mt-1`}>This will be included in the payment memo</p>
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
              disabled={creating || (formData.fixedAmount && !formData.amount)}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-xl font-medium flex items-center justify-center gap-2"
            >
              {creating ? <Loader2 size={18} className="animate-spin" /> : <QrCode size={18} />}
              Create QR Code
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // QR Detail Modal
  const QRDetailModal = ({ qr }) => {
    const qrData = getQRDataUrl(qr);
    const session = getSession();
    
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className={`${theme.bgCard} rounded-2xl shadow-2xl w-full max-w-md`}>
          {/* Header */}
          <div className={`p-6 border-b ${theme.border} flex items-center justify-between`}>
            <div>
              <h2 className={`text-xl font-bold ${theme.text}`}>
                {qr.label || 'Payment QR Code'}
              </h2>
              <p className={`${theme.textMuted} text-sm mt-1`}>
                {formatAmount(qr.amount, qr.currency)}
              </p>
            </div>
            <button onClick={() => setSelectedQR(null)} className={`p-2 ${theme.hover} rounded-full`}>
              ✕
            </button>
          </div>

          {/* QR Code Display */}
          <div className="p-8 flex flex-col items-center" id={`qr-${qr.id}`}>
            <div className="bg-white p-6 rounded-2xl shadow-lg">
              <QRCodeSVG 
                value={qrData} 
                size={220}
                level="H"
                includeMargin={true}
                imageSettings={{
                  src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366f1'%3E%3Cpath d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/%3E%3C/svg%3E",
                  height: 30,
                  width: 30,
                  excavate: true,
                }}
              />
            </div>
            
            {session?.handle && (
              <div className={`mt-4 text-lg font-medium ${theme.text}`}>
                @{session.handle}
              </div>
            )}
            
            {qr.reference && (
              <div className={`${theme.textMuted} text-sm mt-1`}>
                Ref: {qr.reference}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className={`mx-6 grid grid-cols-2 gap-4 py-4 border-t ${theme.border}`}>
            <div className="text-center">
              <div className={`text-2xl font-bold ${theme.text}`}>{qr.scan_count || 0}</div>
              <div className={`text-xs ${theme.textMuted}`}>Total Scans</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${theme.text}`}>{qr.payment_count || 0}</div>
              <div className={`text-xs ${theme.textMuted}`}>Payments</div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 space-y-3">
            <div className="flex gap-3">
              <button
                onClick={() => downloadQR(qr)}
                className={`flex-1 py-3 ${theme.bgInput} ${theme.text} rounded-xl font-medium ${theme.hover} flex items-center justify-center gap-2`}
              >
                <Download size={18} />
                Download PNG
              </button>
              <button
                onClick={() => copyLink(qr)}
                className={`flex-1 py-3 ${theme.bgInput} ${theme.text} rounded-xl font-medium ${theme.hover} flex items-center justify-center gap-2`}
              >
                {copiedId === qr.id ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                {copiedId === qr.id ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <button
              onClick={() => window.print()}
              className={`w-full py-3 ${theme.bgInput} ${theme.text} rounded-xl font-medium ${theme.hover} flex items-center justify-center gap-2`}
            >
              <Printer size={18} />
              Print QR Code
            </button>
            <button
              onClick={() => deleteQRCode(qr.id)}
              className="w-full py-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center justify-center gap-2"
            >
              <Trash2 size={18} />
              Deactivate QR Code
            </button>
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
            <QrCode size={24} className="text-indigo-500" />
            QR Codes
          </h1>
          <p className={`${theme.textMuted} text-sm`}>Generate QR codes for easy payments</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchQRCodes}
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
            New QR Code
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
            <button onClick={fetchQRCodes} className="mt-4 text-indigo-500 hover:underline">
              Try again
            </button>
          </div>
        ) : qrCodes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode size={32} className="text-indigo-500" />
            </div>
            <h3 className={`text-lg font-medium ${theme.text}`}>No QR codes yet</h3>
            <p className={`${theme.textMuted} mt-1`}>Create a QR code to start receiving payments</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
            >
              Create QR Code
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {qrCodes.map((qr) => (
              <div
                key={qr.id}
                onClick={() => setSelectedQR(qr)}
                className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} ${theme.hover} cursor-pointer transition-all`}
              >
                {/* Mini QR Preview */}
                <div className="flex items-start gap-4">
                  <div className="bg-white p-2 rounded-lg shadow">
                    <QRCodeSVG 
                      value={getQRDataUrl(qr)} 
                      size={80}
                      level="M"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${theme.text} truncate`}>
                      {qr.label || 'Payment QR'}
                    </div>
                    <div className={`text-sm ${theme.textMuted}`}>
                      {formatAmount(qr.amount, qr.currency)}
                    </div>
                    <div className={`text-xs ${theme.textMuted} mt-2`}>
                      {qr.scan_count || 0} scans • {qr.payment_count || 0} payments
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700">
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadQR(qr); }}
                    className={`flex-1 py-2 ${theme.bgInput} ${theme.hover} rounded-lg text-sm flex items-center justify-center gap-1`}
                  >
                    <Download size={14} />
                    Download
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyLink(qr); }}
                    className={`flex-1 py-2 ${theme.bgInput} ${theme.hover} rounded-lg text-sm flex items-center justify-center gap-1`}
                  >
                    {copiedId === qr.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    {copiedId === qr.id ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && <CreateModal />}
      {selectedQR && <QRDetailModal qr={selectedQR} />}
    </div>
  );
};

export default QRCodeManager;
