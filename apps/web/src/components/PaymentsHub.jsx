/**
 * GNS Payments Hub
 * 
 * Main dashboard for all payment features
 * Location: src/components/PaymentsHub.jsx
 */

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Link2, FileText, QrCode, 
  TrendingUp, Clock, DollarSign, Users,
  ChevronRight, Plus, ArrowUpRight, ArrowDownLeft,
  Loader2, RefreshCw, Settings
} from 'lucide-react';
import { getSession } from '@gns/api-web';

// Import sub-components (same folder)
import PaymentLinksManager from './PaymentLinksManager';
import InvoiceManager from './InvoiceManager';
import QRCodeManager from './QRCodeManager';

// API Configuration
const API_BASE = process.env.REACT_APP_API_URL || 'https://superb-adaptation-production.up.railway.app';

/**
 * Payments Hub Component
 */
const PaymentsHub = ({ darkMode = false, onNavigate }) => {
  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Fetch dashboard stats
  const fetchStats = async () => {
    try {
      setLoading(true);
      const session = getSession();
      if (!session?.publicKey) {
        setError('Please sign in to view payments');
        return;
      }

      // Fetch multiple endpoints in parallel
      const [linksRes, invoicesRes, qrRes] = await Promise.all([
        fetch(`${API_BASE}/api/link/list`, {
          headers: {
            'X-GNS-PublicKey': session.publicKey,
            'X-GNS-Session': session.sessionToken || '',
          }
        }),
        fetch(`${API_BASE}/api/invoice/list`, {
          headers: {
            'X-GNS-PublicKey': session.publicKey,
            'X-GNS-Session': session.sessionToken || '',
          }
        }),
        fetch(`${API_BASE}/api/qr/list`, {
          headers: {
            'X-GNS-PublicKey': session.publicKey,
            'X-GNS-Session': session.sessionToken || '',
          }
        }),
      ]);

      const [linksData, invoicesData, qrData] = await Promise.all([
        linksRes.ok ? linksRes.json() : { links: [] },
        invoicesRes.ok ? invoicesRes.json() : { invoices: [] },
        qrRes.ok ? qrRes.json() : { qrCodes: [] },
      ]);

      // Calculate stats
      const links = linksData.links || [];
      const invoices = invoicesData.invoices || [];
      const qrCodes = qrData.qrCodes || [];

      const totalReceived = invoices
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + parseFloat(i.total || 0), 0);

      const pendingAmount = invoices
        .filter(i => i.status === 'sent' || i.status === 'viewed')
        .reduce((sum, i) => sum + parseFloat(i.total || 0), 0);

      setStats({
        totalLinks: links.length,
        activeLinks: links.filter(l => l.status === 'active').length,
        totalInvoices: invoices.length,
        paidInvoices: invoices.filter(i => i.status === 'paid').length,
        pendingInvoices: invoices.filter(i => i.status === 'sent' || i.status === 'viewed').length,
        totalQRCodes: qrCodes.length,
        totalReceived,
        pendingAmount,
        linkPayments: links.reduce((sum, l) => sum + (l.payment_count || 0), 0),
        qrPayments: qrCodes.reduce((sum, q) => sum + (q.payment_count || 0), 0),
      });

      // Build recent activity
      const activity = [
        ...invoices.map(i => ({
          type: 'invoice',
          id: i.id,
          title: `Invoice #${i.invoice_number}`,
          amount: i.total,
          currency: i.currency,
          status: i.status,
          date: i.created_at,
          customer: i.customer_handle || i.customer_email,
        })),
        ...links.filter(l => l.payment_count > 0).map(l => ({
          type: 'link',
          id: l.id,
          title: l.title || 'Payment Link',
          amount: l.amount,
          currency: l.currency,
          payments: l.payment_count,
          date: l.created_at,
        })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

      setRecentActivity(activity);
      setError(null);
    } catch (err) {
      console.error('Fetch stats error:', err);
      setError('Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchStats();
    }
  }, [activeTab]);

  // Format currency
  const formatAmount = (amount, currency = 'EUR') => {
    const symbols = { EUR: '€', USD: '$', GBP: '£', GNS: '✦' };
    return `${symbols[currency] || currency} ${parseFloat(amount || 0).toFixed(2)}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Status badge
  const StatusBadge = ({ status }) => {
    const colors = {
      paid: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      sent: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      viewed: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
      draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
      overdue: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      active: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.draft}`}>
        {status}
      </span>
    );
  };

  // Quick Action Card
  const QuickActionCard = ({ icon: Icon, title, description, onClick, color }) => (
    <button
      onClick={onClick}
      className={`${theme.bgCard} rounded-xl p-4 border ${theme.border} ${theme.hover} text-left transition-all w-full`}
    >
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className={`font-medium ${theme.text}`}>{title}</div>
      <div className={`text-sm ${theme.textMuted}`}>{description}</div>
    </button>
  );

  // Overview Tab
  const OverviewTab = () => (
    <div className="p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`${theme.bgCard} rounded-xl p-5 border ${theme.border}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${theme.textMuted}`}>Total Received</p>
              <p className={`text-2xl font-bold text-green-500 mt-1`}>
                {formatAmount(stats?.totalReceived)}
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
              <p className={`text-2xl font-bold text-yellow-500 mt-1`}>
                {formatAmount(stats?.pendingAmount)}
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
                {stats?.activeLinks || 0}
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
                {stats?.paidInvoices || 0}/{stats?.totalInvoices || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <FileText size={24} className="text-blue-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className={`text-lg font-semibold ${theme.text} mb-4`}>Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionCard
            icon={Link2}
            title="Create Payment Link"
            description="Generate a shareable link"
            onClick={() => setActiveTab('links')}
            color="bg-indigo-500"
          />
          <QuickActionCard
            icon={FileText}
            title="Create Invoice"
            description="Bill your customers"
            onClick={() => setActiveTab('invoices')}
            color="bg-blue-500"
          />
          <QuickActionCard
            icon={QrCode}
            title="Generate QR Code"
            description="For in-person payments"
            onClick={() => setActiveTab('qr')}
            color="bg-purple-500"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className={`text-lg font-semibold ${theme.text} mb-4`}>Recent Activity</h3>
        <div className={`${theme.bgCard} rounded-xl border ${theme.border} overflow-hidden`}>
          {recentActivity.length === 0 ? (
            <div className="p-8 text-center">
              <div className={`${theme.textMuted}`}>No recent activity</div>
              <p className={`text-sm ${theme.textMuted} mt-1`}>
                Create a payment link or invoice to get started
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentActivity.map((item, index) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className={`p-4 ${theme.hover} cursor-pointer transition-colors`}
                  onClick={() => setActiveTab(item.type === 'invoice' ? 'invoices' : 'links')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        item.type === 'invoice' 
                          ? 'bg-blue-100 dark:bg-blue-900/30' 
                          : 'bg-indigo-100 dark:bg-indigo-900/30'
                      }`}>
                        {item.type === 'invoice' ? (
                          <FileText size={20} className="text-blue-500" />
                        ) : (
                          <Link2 size={20} className="text-indigo-500" />
                        )}
                      </div>
                      <div>
                        <div className={`font-medium ${theme.text}`}>{item.title}</div>
                        <div className={`text-sm ${theme.textMuted}`}>
                          {item.customer || (item.payments ? `${item.payments} payments` : '')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.amount && (
                        <div className={`font-bold ${theme.text}`}>
                          {formatAmount(item.amount, item.currency)}
                        </div>
                      )}
                      {item.status && <StatusBadge status={item.status} />}
                      <span className={`text-sm ${theme.textMuted}`}>
                        {formatDate(item.date)}
                      </span>
                      <ChevronRight size={18} className={theme.textMuted} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment Methods Summary */}
      <div>
        <h3 className={`text-lg font-semibold ${theme.text} mb-4`}>Payment Methods</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                <Link2 size={20} className="text-indigo-500" />
              </div>
              <div>
                <div className={`font-medium ${theme.text}`}>Payment Links</div>
                <div className={`text-sm ${theme.textMuted}`}>
                  {stats?.linkPayments || 0} payments received
                </div>
              </div>
            </div>
          </div>

          <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <QrCode size={20} className="text-purple-500" />
              </div>
              <div>
                <div className={`font-medium ${theme.text}`}>QR Codes</div>
                <div className={`text-sm ${theme.textMuted}`}>
                  {stats?.qrPayments || 0} payments received
                </div>
              </div>
            </div>
          </div>

          <div className={`${theme.bgCard} rounded-xl p-4 border ${theme.border}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <FileText size={20} className="text-blue-500" />
              </div>
              <div>
                <div className={`font-medium ${theme.text}`}>Invoices</div>
                <div className={`text-sm ${theme.textMuted}`}>
                  {stats?.paidInvoices || 0} of {stats?.totalInvoices || 0} paid
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render tab content
  const renderContent = () => {
    if (loading && activeTab === 'overview') {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'links':
        return <PaymentLinksManager darkMode={darkMode} />;
      case 'invoices':
        return <InvoiceManager darkMode={darkMode} />;
      case 'qr':
        return <QRCodeManager darkMode={darkMode} />;
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
            <p className={`${theme.textMuted}`}>Manage your payment links, invoices, and QR codes</p>
          </div>
          <button
            onClick={fetchStats}
            className={`p-2 ${theme.bgInput} ${theme.hover} rounded-lg`}
            title="Refresh"
          >
            <RefreshCw size={18} className={theme.textMuted} />
          </button>
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
        {error ? (
          <div className="flex flex-col items-center justify-center h-64">
            <p className={theme.textMuted}>{error}</p>
            <button 
              onClick={fetchStats}
              className="mt-4 text-indigo-500 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          renderContent()
        )}
      </div>
    </div>
  );
};

export default PaymentsHub;
