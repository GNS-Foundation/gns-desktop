/**
 * GNS Pay Page
 * 
 * Displays payment link details and allows users to pay
 * Route: /pay/:code
 * 
 * Location: src/components/PayPage.jsx
 */

import React, { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'https://superb-adaptation-production.up.railway.app';

const PayPage = ({ code, darkMode = false, onBack, onSignIn, isAuthenticated }) => {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  // Theme
  const bg = darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-50 to-purple-50';
  const bgCard = darkMode ? 'bg-gray-800' : 'bg-white';
  const text = darkMode ? 'text-white' : 'text-gray-900';
  const textMuted = darkMode ? 'text-gray-400' : 'text-gray-600';

  // Fetch payment link details
  useEffect(() => {
    const fetchLink = async () => {
      try {
        setLoading(true);
        
        // Try to fetch from API
        const response = await fetch(`${API_BASE}/api/link/${code}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.link) {
            setLink(data.link);
          } else {
            // Link not found in API - show demo
            setLink({
              code,
              title: `Payment #${code}`,
              description: 'Payment link created locally',
              amount: 5.00,
              currency: 'EUR',
              recipientHandle: '@merchant',
              offline: true,
            });
          }
        } else {
          // API not available - show demo mode
          setLink({
            code,
            title: `Payment #${code}`,
            description: 'Payment request',
            amount: 5.00,
            currency: 'EUR',
            recipientHandle: '@merchant',
            offline: true,
          });
        }
      } catch (err) {
        console.error('Fetch link error:', err);
        // Show offline mode
        setLink({
          code,
          title: `Payment #${code}`,
          description: 'API not available - preview mode',
          amount: 5.00,
          currency: 'EUR',
          recipientHandle: '@merchant',
          offline: true,
        });
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      fetchLink();
    }
  }, [code]);

  // Format amount
  const formatAmount = (amount, currency) => {
    const symbol = currency === 'USD' || currency === 'USDC' ? '$' : '€';
    return `${symbol}${parseFloat(amount || 0).toFixed(2)}`;
  };

  // Handle payment
  const handlePay = async () => {
    if (!isAuthenticated) {
      if (onSignIn) onSignIn();
      return;
    }

    setPaying(true);
    
    // Simulate payment for now (will connect to Stellar later)
    setTimeout(() => {
      setPaying(false);
      setPaid(true);
    }, 2000);
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className={textMuted}>Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center p-4`}>
        <div className={`${bgCard} rounded-2xl shadow-xl p-8 max-w-md w-full text-center`}>
          <div className="text-5xl mb-4">❌</div>
          <h1 className={`text-2xl font-bold ${text} mb-2`}>Payment Link Not Found</h1>
          <p className={textMuted}>This payment link may have expired or been deactivated.</p>
          <button
            onClick={onBack}
            className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (paid) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center p-4`}>
        <div className={`${bgCard} rounded-2xl shadow-xl p-8 max-w-md w-full text-center`}>
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✓</span>
          </div>
          <h1 className={`text-2xl font-bold ${text} mb-2`}>Payment Sent!</h1>
          <p className={textMuted}>
            {formatAmount(link.amount, link.currency)} sent to {link.recipientHandle}
          </p>
          <button
            onClick={onBack}
            className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} flex items-center justify-center p-4`}>
      <div className={`${bgCard} rounded-2xl shadow-xl p-8 max-w-md w-full`}>
        {/* GNS Logo */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">GNS</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className={`text-2xl font-bold ${text}`}>{link.title}</h1>
          {link.description && (
            <p className={`${textMuted} mt-2`}>{link.description}</p>
          )}
        </div>

        {/* Amount */}
        <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-xl p-6 text-center mb-6`}>
          <p className={`text-sm ${textMuted} mb-1`}>Amount to Pay</p>
          <p className={`text-5xl font-bold ${text}`}>
            {formatAmount(link.amount, link.currency)}
          </p>
          <p className={`text-sm ${textMuted} mt-3`}>
            To: <span className="font-medium text-indigo-500">{link.recipientHandle || '@merchant'}</span>
          </p>
        </div>

        {/* Offline Warning */}
        {link.offline && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-6">
            <p className="text-sm text-yellow-700 dark:text-yellow-400 text-center">
              ⚠️ Demo mode - Backend API coming soon
            </p>
          </div>
        )}

        {/* Pay Button */}
        <button
          onClick={handlePay}
          disabled={paying}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
            paying
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg transform hover:scale-[1.02]'
          }`}
        >
          {paying ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Processing...
            </span>
          ) : isAuthenticated ? (
            `Pay ${formatAmount(link.amount, link.currency)}`
          ) : (
            'Sign in to Pay'
          )}
        </button>

        {/* Payment Methods */}
        <div className="mt-6 flex justify-center gap-4">
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <span>💳</span> EURC
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <span>💵</span> USDC
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <span>⭐</span> XLM
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className={`text-xs ${textMuted}`}>
            Secured by <span className="font-medium">GNS Protocol</span> on Stellar Network
          </p>
        </div>

        {/* Back Link */}
        <button
          onClick={onBack}
          className={`mt-4 w-full py-2 ${textMuted} hover:text-indigo-500 text-sm transition-colors`}
        >
          ← Back to Panthera Browser
        </button>
      </div>
    </div>
  );
};

export default PayPage;
