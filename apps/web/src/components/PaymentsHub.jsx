/**
 * GNS Payments Hub - Simplified Version
 * 
 * Works without backend APIs (mock data until deployed)
 * No external QR library dependency
 * 
 * Location: src/components/PaymentsHub.jsx
 */

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Link2, FileText, QrCode, 
  TrendingUp, Clock, DollarSign, Users,
  ChevronRight, Plus, ArrowUpRight, ArrowDownLeft,
  Loader2, RefreshCw, Settings, Copy, Check,
  X, ExternalLink, Trash2, Send, Eye
} from 'lucide-react';
import { getSession } from '@gns/api-web';

// API Configuration
const API_BASE = process.env.REACT_APP_API_URL || 'https://superb-adaptation-production.up.railway.app';

/**
 * Payments Hub Component
 */
const PaymentsHub = ({ darkMode = false, onNavigate }) => {
  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(false);
  
  // Payment Links state
  const [links, setLinks] = useState([]);
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [newLink, setNewLink] = useState({ title: '', amount: '', currency: 'EUR', description: '' });
  
  // Invoices state
  const [invoices, setInvoices] = useState([]);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  
  // QR Codes state
  const [qrCodes, setQrCodes] = useState([]);
  const [showCreateQR, setShowCreateQR] = useState(false);
  
  // UI state
  const [copiedId, setCopiedId] = useState(null);

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

  // Tab configuration
  const tabs = [
    { id: 'overview', label: 'Overview', icon: CreditCard },
    { id: 'links', label: 'Payment Links', icon: Link2 },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'qr', label: 'QR Codes', icon: QrCode },
  ];

  // Check if API is available
  useEffect(() => {
    const checkApi = async () => {
      try {
        const session = getSession();
        if (!session?.publicKey) return;
        
        const response = await fetch(`${API_BASE}/api/link/list`, {
          headers: { 'X-GNS-PublicKey': session.publicKey }
        });
        
        if (response.ok) {
          setApiAvailable(true);
          const data = await response.json();
          setLinks(data.links || []);
        }
      } catch (e) {
        console.log('Payment API not yet available');
        setApiAvailable(false);
      }
    };
    
    checkApi();
  }, []);

  // Format currency
  const formatAmount = (amount, currency = 'EUR') => {
    const symbol = currency === 'USD' || currency === 'USDC' ? '$' : '€';
    return `${symbol} ${parseFloat(amount || 0).toFixed(2)}`;
  };

  // Copy to clipboard
  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  // Generate link code (mock)
  const generateCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

  // Create payment link (local for now)
  const handleCreateLink = (e) => {
    e.preventDefault();
    const code = generateCode();
    const link = {
      id: Date.now().toString(),
      code,
      title: newLink.title,
      description: newLink.description,
      amount: parseFloat(newLink.amount),
      currency: newLink.currency,
      status: 'active',
      url: `https://panthera.gcrumbs.com/pay/${code}`,
      createdAt: new Date().toISOString(),
      paymentCount: 0,
    };
    setLinks([link, ...links]);
    setShowCreateLink(false);
    setNewLink({ title: '', amount: '', currency: 'EUR', description: '' });
  };

  // Stats calculation
  const stats = {
    totalReceived: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0),
    pendingAmount: invoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + (i.total || 0), 0),
    activeLinks: links.filter(l => l.status === 'active').length,
    paidInvoices: invoices.filter(i => i.status === 'paid').length,
    totalInvoices: invoices.length,
  };

  // Overview Tab
  const OverviewTab = () => (
    <div className="p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`${theme.bgCard} rounded-xl p-5 border ${theme.border}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${theme.textMuted}`}>Total Received</p>
              <p className="text-2xl font-bold text-green-500 mt-1">
                {formatAmount(stats.totalReceived)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <ArrowDownLeft size={24} className="text-green-500" />
            </div>
          </div>
        </div>

        <div className={`${theme.bgCard} rounded-xl p-5 border ${theme.border}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${theme.textMuted}`}>Pending</p>
              <p className="text-2xl font-bold text-yellow-500 mt-1">
                {formatAmount(stats.pendingAmount)}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
              <Clock size={24} className="text-yellow-500" />
            </div>
          </div>
        </div>

        <div className={`${theme.bgCard} rounded-xl p-5 border ${theme.border}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${theme.textMuted}`}>Active Links</p>
              <p className={`text-2xl font-bold ${theme.text} mt-1`}>
                {stats.activeLinks}
              </p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
              <Link2 size={24} className="text-indigo-500" />
            </div>
          </div>
        </div>

        <div className={`${theme.bgCard} rounded-xl p-5 border ${theme.border}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${theme.textMuted}`}>Invoices Paid</p>
              <p className={`text-2xl font-bold ${theme.text} mt-1`}>
                {stats.paidInvoices}/{stats.totalInvoices}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
              <FileText size={24} className="text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className={`font-semibold ${theme.text} mb-4`}>Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => { setActiveTab('links'); setShowCreateLink(true); }}
            className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} ${theme.hover} text-left transition-all`}
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center mb-3">
              <Link2 size={20} className="text-white" />
            </div>
            <div className={`font-medium ${theme.text}`}>Create Payment Link</div>
            <div className={`text-sm ${theme.textMuted}`}>Generate a shareable link</div>
          </button>

          <button
            onClick={() => { setActiveTab('invoices'); setShowCreateInvoice(true); }}
            className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} ${theme.hover} text-left transition-all`}
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center mb-3">
              <FileText size={20} className="text-white" />
            </div>
            <div className={`font-medium ${theme.text}`}>Create Invoice</div>
            <div className={`text-sm ${theme.textMuted}`}>Bill your customers</div>
          </button>

          <button
            onClick={() => { setActiveTab('qr'); setShowCreateQR(true); }}
            className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} ${theme.hover} text-left transition-all`}
          >
            <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center mb-3">
              <QrCode size={20} className="text-white" />
            </div>
            <div className={`font-medium ${theme.text}`}>Generate QR Code</div>
            <div className={`text-sm ${theme.textMuted}`}>For in-person payments</div>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className={`font-semibold ${theme.text} mb-4`}>Recent Activity</h3>
        <div className={`${theme.bgCard} rounded-xl border ${theme.border} p-8 text-center`}>
          <p className={theme.textMuted}>No recent activity</p>
          <p className={`text-sm ${theme.textMuted} mt-1`}>Create a payment link or invoice to get started</p>
        </div>
      </div>

      {/* Payment Methods Info */}
      <div>
        <h3 className={`font-semibold ${theme.text} mb-4`}>Payment Methods</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border}`}>
            <div className="flex items-center gap-3">
              <Link2 size={24} className="text-indigo-500" />
              <div>
                <div className={`font-medium ${theme.text}`}>Payment Links</div>
                <div className={`text-sm ${theme.textMuted}`}>Share via email, SMS, social</div>
              </div>
            </div>
          </div>
          <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border}`}>
            <div className="flex items-center gap-3">
              <QrCode size={24} className="text-green-500" />
              <div>
                <div className={`font-medium ${theme.text}`}>QR Codes</div>
                <div className={`text-sm ${theme.textMuted}`}>Scan to pay in person</div>
              </div>
            </div>
          </div>
          <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border}`}>
            <div className="flex items-center gap-3">
              <FileText size={24} className="text-purple-500" />
              <div>
                <div className={`font-medium ${theme.text}`}>Invoices</div>
                <div className={`text-sm ${theme.textMuted}`}>Professional billing</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Payment Links Tab
  const PaymentLinksTab = () => (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${theme.text}`}>Payment Links</h2>
          <p className={theme.textMuted}>Create and manage shareable payment links</p>
        </div>
        <button
          onClick={() => setShowCreateLink(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
        >
          <Plus size={18} />
          Create Link
        </button>
      </div>

      {/* Links List */}
      {links.length === 0 ? (
        <div className={`${theme.bgCard} rounded-xl border ${theme.border} p-12 text-center`}>
          <Link2 size={48} className={`${theme.textMuted} mx-auto mb-4`} />
          <h3 className={`font-semibold ${theme.text} mb-2`}>No payment links yet</h3>
          <p className={theme.textMuted}>Create your first payment link to start accepting payments</p>
          <button
            onClick={() => setShowCreateLink(true)}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Create Payment Link
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <div key={link.id} className={`${theme.bgCard} rounded-xl border ${theme.border} p-4`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-medium ${theme.text}`}>{link.title}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      link.status === 'active' 
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {link.status}
                    </span>
                  </div>
                  <p className={`text-sm ${theme.textMuted} mt-1`}>{link.url}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`font-semibold ${theme.text}`}>{formatAmount(link.amount, link.currency)}</p>
                    <p className={`text-xs ${theme.textMuted}`}>{link.paymentCount || 0} payments</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(link.url, link.id)}
                    className={`p-2 ${theme.hover} rounded-lg`}
                    title="Copy link"
                  >
                    {copiedId === link.id ? (
                      <Check size={18} className="text-green-500" />
                    ) : (
                      <Copy size={18} className={theme.textMuted} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Link Modal */}
      {showCreateLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${theme.bgCard} rounded-2xl p-6 w-full max-w-md mx-4`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold ${theme.text}`}>Create Payment Link</h3>
              <button onClick={() => setShowCreateLink(false)} className={`p-2 ${theme.hover} rounded-lg`}>
                <X size={20} className={theme.textMuted} />
              </button>
            </div>
            
            <form onSubmit={handleCreateLink} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Title *</label>
                <input
                  type="text"
                  value={newLink.title}
                  onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                  placeholder="e.g., Coffee Payment"
                  className={`w-full px-4 py-3 rounded-lg ${theme.bgInput} ${theme.text} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-2`}>Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newLink.amount}
                    onChange={(e) => setNewLink({ ...newLink, amount: e.target.value })}
                    placeholder="0.00"
                    className={`w-full px-4 py-3 rounded-lg ${theme.bgInput} ${theme.text} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-2`}>Currency</label>
                  <select
                    value={newLink.currency}
                    onChange={(e) => setNewLink({ ...newLink, currency: e.target.value })}
                    className={`w-full px-4 py-3 rounded-lg ${theme.bgInput} ${theme.text} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EURC">EURC (€)</option>
                    <option value="USDC">USDC ($)</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Description</label>
                <textarea
                  value={newLink.description}
                  onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={3}
                  className={`w-full px-4 py-3 rounded-lg ${theme.bgInput} ${theme.text} border ${theme.border} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateLink(false)}
                  className={`flex-1 px-4 py-3 ${theme.bgInput} ${theme.text} rounded-lg ${theme.hover}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // Invoices Tab (simplified)
  const InvoicesTab = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${theme.text}`}>Invoices</h2>
          <p className={theme.textMuted}>Create and send professional invoices</p>
        </div>
        <button
          onClick={() => setShowCreateInvoice(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
        >
          <Plus size={18} />
          Create Invoice
        </button>
      </div>

      <div className={`${theme.bgCard} rounded-xl border ${theme.border} p-12 text-center`}>
        <FileText size={48} className={`${theme.textMuted} mx-auto mb-4`} />
        <h3 className={`font-semibold ${theme.text} mb-2`}>No invoices yet</h3>
        <p className={theme.textMuted}>Create your first invoice to bill your customers</p>
        <button
          onClick={() => setShowCreateInvoice(true)}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Create Invoice
        </button>
      </div>
    </div>
  );

  // QR Codes Tab (simplified)
  const QRCodesTab = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${theme.text}`}>QR Codes</h2>
          <p className={theme.textMuted}>Generate QR codes for in-person payments</p>
        </div>
        <button
          onClick={() => setShowCreateQR(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <Plus size={18} />
          Generate QR
        </button>
      </div>

      <div className={`${theme.bgCard} rounded-xl border ${theme.border} p-12 text-center`}>
        <QrCode size={48} className={`${theme.textMuted} mx-auto mb-4`} />
        <h3 className={`font-semibold ${theme.text} mb-2`}>No QR codes yet</h3>
        <p className={theme.textMuted}>Generate a QR code for customers to scan and pay</p>
        <button
          onClick={() => setShowCreateQR(true)}
          className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Generate QR Code
        </button>
      </div>
    </div>
  );

  // Render tab content
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'links':
        return <PaymentLinksTab />;
      case 'invoices':
        return <InvoicesTab />;
      case 'qr':
        return <QRCodesTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div className={`h-full flex flex-col ${theme.bg}`}>
      {/* Header */}
      <div className={`${theme.bgCard} border-b ${theme.border} px-6 py-4`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className={`text-2xl font-bold ${theme.text}`}>Payments</h1>
            <p className={theme.textMuted}>Manage your payment links, invoices, and QR codes</p>
          </div>
          <RefreshCw size={18} className={theme.textMuted} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : `${theme.text} ${theme.hover}`
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>

      {/* API Status Banner */}
      {!apiAvailable && (
        <div className="px-6 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-700 dark:text-yellow-400 text-center">
            ⚠️ Payment API not yet deployed. Links are stored locally for now.
          </p>
        </div>
      )}
    </div>
  );
};

export default PaymentsHub;
