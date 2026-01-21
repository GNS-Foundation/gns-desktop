/**
 * GNS Payments Hub - Ultra Simple Version
 * Location: src/components/PaymentsHub.jsx
 */

import React, { useState } from 'react';

const PaymentsHub = ({ darkMode = false }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [links, setLinks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ title: '', amount: '', currency: 'EUR', description: '' });
  const [copiedId, setCopiedId] = useState(null);

  // Theme
  const bg = darkMode ? 'bg-gray-900' : 'bg-gray-50';
  const bgCard = darkMode ? 'bg-gray-800' : 'bg-white';
  const bgInput = darkMode ? 'bg-gray-700' : 'bg-gray-100';
  const text = darkMode ? 'text-white' : 'text-gray-900';
  const textMuted = darkMode ? 'text-gray-400' : 'text-gray-600';
  const border = darkMode ? 'border-gray-700' : 'border-gray-200';

  // Handle form input
  const handleInput = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Create link
  const createLink = (e) => {
    e.preventDefault();
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const newLink = {
      id: Date.now().toString(),
      code,
      title: formData.title,
      amount: parseFloat(formData.amount) || 0,
      currency: formData.currency,
      description: formData.description,
      url: `https://panthera.gcrumbs.com/pay/${code}`,
      createdAt: new Date().toISOString(),
    };
    setLinks(prev => [newLink, ...prev]);
    setShowModal(false);
    setFormData({ title: '', amount: '', currency: 'EUR', description: '' });
  };

  // Copy link
  const copyLink = async (url, id) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('Copy failed');
    }
  };

  // Format amount
  const formatAmount = (amount, currency) => {
    const symbol = currency === 'USD' || currency === 'USDC' ? '$' : '€';
    return `${symbol}${parseFloat(amount || 0).toFixed(2)}`;
  };

  return (
    <div className={`h-full flex flex-col ${bg}`}>
      {/* Header */}
      <div className={`${bgCard} border-b ${border} px-6 py-4`}>
        <h1 className={`text-2xl font-bold ${text} mb-1`}>Payments</h1>
        <p className={textMuted}>Manage your payment links, invoices, and QR codes</p>
        
        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {['overview', 'links', 'invoices', 'qr'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium capitalize ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : `${text} hover:bg-gray-100 dark:hover:bg-gray-700`
              }`}
            >
              {tab === 'qr' ? 'QR Codes' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`${bgCard} rounded-xl p-5 border ${border}`}>
                <p className={`text-sm ${textMuted}`}>Total Received</p>
                <p className="text-2xl font-bold text-green-500 mt-1">€ 0.00</p>
              </div>
              <div className={`${bgCard} rounded-xl p-5 border ${border}`}>
                <p className={`text-sm ${textMuted}`}>Pending</p>
                <p className="text-2xl font-bold text-yellow-500 mt-1">€ 0.00</p>
              </div>
              <div className={`${bgCard} rounded-xl p-5 border ${border}`}>
                <p className={`text-sm ${textMuted}`}>Active Links</p>
                <p className={`text-2xl font-bold ${text} mt-1`}>{links.length}</p>
              </div>
              <div className={`${bgCard} rounded-xl p-5 border ${border}`}>
                <p className={`text-sm ${textMuted}`}>Invoices Paid</p>
                <p className={`text-2xl font-bold ${text} mt-1`}>0/0</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h3 className={`font-semibold ${text} mb-4`}>Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => { setActiveTab('links'); setShowModal(true); }}
                  className={`${bgCard} rounded-xl p-4 border ${border} hover:border-indigo-500 text-left transition-all`}
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center mb-3">
                    <span className="text-white text-xl">🔗</span>
                  </div>
                  <div className={`font-medium ${text}`}>Create Payment Link</div>
                  <div className={`text-sm ${textMuted}`}>Generate a shareable link</div>
                </button>

                <button
                  onClick={() => setActiveTab('invoices')}
                  className={`${bgCard} rounded-xl p-4 border ${border} hover:border-purple-500 text-left transition-all`}
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center mb-3">
                    <span className="text-white text-xl">📄</span>
                  </div>
                  <div className={`font-medium ${text}`}>Create Invoice</div>
                  <div className={`text-sm ${textMuted}`}>Bill your customers</div>
                </button>

                <button
                  onClick={() => setActiveTab('qr')}
                  className={`${bgCard} rounded-xl p-4 border ${border} hover:border-green-500 text-left transition-all`}
                >
                  <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center mb-3">
                    <span className="text-white text-xl">📱</span>
                  </div>
                  <div className={`font-medium ${text}`}>Generate QR Code</div>
                  <div className={`text-sm ${textMuted}`}>For in-person payments</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'links' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-xl font-bold ${text}`}>Payment Links</h2>
                <p className={textMuted}>Create and manage shareable payment links</p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                + Create Link
              </button>
            </div>

            {links.length === 0 ? (
              <div className={`${bgCard} rounded-xl border ${border} p-12 text-center`}>
                <div className="text-4xl mb-4">🔗</div>
                <h3 className={`font-semibold ${text} mb-2`}>No payment links yet</h3>
                <p className={textMuted}>Create your first payment link to start accepting payments</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create Payment Link
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {links.map((link) => (
                  <div key={link.id} className={`${bgCard} rounded-xl border ${border} p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-medium ${text}`}>{link.title}</h4>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-600">
                            active
                          </span>
                        </div>
                        <p className={`text-sm ${textMuted} mt-1`}>{link.url}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={`font-semibold ${text}`}>
                          {formatAmount(link.amount, link.currency)}
                        </p>
                        <button
                          onClick={() => copyLink(link.url, link.id)}
                          className={`px-3 py-1.5 ${bgInput} rounded-lg text-sm ${text}`}
                        >
                          {copiedId === link.id ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className={`${bgCard} rounded-xl border ${border} p-12 text-center`}>
            <div className="text-4xl mb-4">📄</div>
            <h3 className={`font-semibold ${text} mb-2`}>Invoices Coming Soon</h3>
            <p className={textMuted}>Invoice creation will be available after backend deployment</p>
          </div>
        )}

        {activeTab === 'qr' && (
          <div className={`${bgCard} rounded-xl border ${border} p-12 text-center`}>
            <div className="text-4xl mb-4">📱</div>
            <h3 className={`font-semibold ${text} mb-2`}>QR Codes Coming Soon</h3>
            <p className={textMuted}>QR code generation will be available after backend deployment</p>
          </div>
        )}
      </div>

      {/* Create Link Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${bgCard} rounded-2xl p-6 w-full max-w-md mx-4`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold ${text}`}>Create Payment Link</h3>
              <button 
                onClick={() => setShowModal(false)} 
                className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg`}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={createLink} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${text} mb-2`}>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInput('title', e.target.value)}
                  placeholder="e.g., Coffee Payment"
                  className={`w-full px-4 py-3 rounded-lg ${bgInput} ${text} border ${border} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${text} mb-2`}>Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => handleInput('amount', e.target.value)}
                    placeholder="0.00"
                    className={`w-full px-4 py-3 rounded-lg ${bgInput} ${text} border ${border} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${text} mb-2`}>Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => handleInput('currency', e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg ${bgInput} ${text} border ${border} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EURC">EURC (€)</option>
                    <option value="USDC">USDC ($)</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${text} mb-2`}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInput('description', e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                  className={`w-full px-4 py-3 rounded-lg ${bgInput} ${text} border ${border} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className={`flex-1 px-4 py-3 ${bgInput} ${text} rounded-lg hover:opacity-80`}
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

      {/* API Status */}
      <div className="px-6 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
        <p className="text-sm text-yellow-700 dark:text-yellow-400 text-center">
          ⚠️ Payment API not yet deployed. Links are stored locally for now.
        </p>
      </div>
    </div>
  );
};

export default PaymentsHub;
