// Payment History Screen
// View past GNS/XLM transactions from Stellar network

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ArrowLeft,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,

  Calendar,
  Search,

  ChevronRight
} from 'lucide-react';

interface PaymentHistoryItem {
  id: string;
  tx_hash: string;
  created_at: string;
  direction: string;
  amount: string;
  asset_code: string;
  from_address: string;
  to_address: string;
  memo: string | null;
}

interface PaymentHistoryScreenProps {
  onBack: () => void;
}

const ASSET_SYMBOLS: Record<string, string> = {
  GNS: '✦',
  XLM: '⋆',
};



export function PaymentHistoryScreen({ onBack }: PaymentHistoryScreenProps) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [useTestnet, setUseTestnet] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await invoke<PaymentHistoryItem[]>('get_payment_history', { limit: 50 });
      setHistory(data);

      // Check if testnet
      const balances = await invoke<{ use_testnet: boolean }>('get_stellar_balances');
      setUseTestnet(balances.use_testnet);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Filter transactions
  const filteredHistory = history.filter(tx => {
    // Direction filter
    if (filter === 'sent' && tx.direction !== 'sent') return false;
    if (filter === 'received' && tx.direction !== 'received') return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        tx.from_address.toLowerCase().includes(query) ||
        tx.to_address.toLowerCase().includes(query) ||
        tx.asset_code.toLowerCase().includes(query) ||
        tx.memo?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Group by date
  const groupedHistory = groupByDate(filteredHistory);

  const openExplorer = (txHash: string) => {
    const network = useTestnet ? 'testnet' : 'public';
    const url = `https://stellar.expert/explorer/${network}/tx/${txHash}`;
    window.open(url, '_blank');
  };

  if (loading && history.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-2" />
          <p className="text-slate-400">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <h1 className="text-lg font-semibold text-white">Transaction History</h1>
        </div>
        <button
          onClick={loadHistory}
          disabled={loading}
          className="p-2 hover:bg-slate-800 rounded-lg"
        >
          <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Search & Filter */}
      <div className="p-4 space-y-3 border-b border-slate-800">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by address or memo..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <FilterButton
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            All
          </FilterButton>
          <FilterButton
            active={filter === 'received'}
            onClick={() => setFilter('received')}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Received
          </FilterButton>
          <FilterButton
            active={filter === 'sent'}
            onClick={() => setFilter('sent')}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Sent
          </FilterButton>
        </div>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-auto">
        {error ? (
          <div className="p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={loadHistory}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
              Retry
            </button>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-400">
              {searchQuery || filter !== 'all'
                ? 'No transactions match your filters'
                : 'No transactions yet'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {Object.entries(groupedHistory).map(([date, transactions]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="px-4 py-2 bg-slate-800/50 sticky top-0">
                  <span className="text-xs font-medium text-slate-400 uppercase">
                    {date}
                  </span>
                </div>

                {/* Transactions */}
                {transactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    transaction={tx}
                    onViewExplorer={() => openExplorer(tx.tx_hash)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Network Info */}
      <div className="flex items-center justify-center gap-2 p-3 bg-slate-800/50 border-t border-slate-800">
        <div className={`w-2 h-2 rounded-full ${useTestnet ? 'bg-amber-400' : 'bg-emerald-400'}`} />
        <span className="text-xs text-slate-400">
          {useTestnet ? 'Stellar Testnet' : 'Stellar Mainnet'}
        </span>
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

function FilterButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors ${active
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
        }`}
    >
      {children}
    </button>
  );
}

function TransactionRow({
  transaction,
  onViewExplorer
}: {
  transaction: PaymentHistoryItem;
  onViewExplorer: () => void;
}) {
  const isSent = transaction.direction === 'sent';
  const symbol = ASSET_SYMBOLS[transaction.asset_code] || '';


  // Format time
  const date = new Date(transaction.created_at);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Truncate address
  const displayAddress = isSent
    ? truncateAddress(transaction.to_address)
    : truncateAddress(transaction.from_address);

  return (
    <button
      onClick={onViewExplorer}
      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-800/50 transition-colors text-left"
    >
      {/* Direction Icon */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSent ? 'bg-red-500/10' : 'bg-emerald-500/10'
        }`}>
        {isSent ? (
          <ArrowUpRight className="w-5 h-5 text-red-400" />
        ) : (
          <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">
            {isSent ? 'Sent' : 'Received'}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${transaction.asset_code === 'GNS'
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-blue-500/20 text-blue-400'
            }`}>
            {transaction.asset_code}
          </span>
        </div>
        <div className="text-sm text-slate-400 truncate">
          {isSent ? 'To: ' : 'From: '}{displayAddress}
        </div>
        {transaction.memo && (
          <div className="text-xs text-slate-500 truncate mt-0.5">
            📝 {transaction.memo}
          </div>
        )}
      </div>

      {/* Amount & Time */}
      <div className="text-right flex-shrink-0">
        <div className={`font-bold ${isSent ? 'text-red-400' : 'text-emerald-400'}`}>
          {isSent ? '-' : '+'}{symbol}{parseFloat(transaction.amount).toFixed(2)}
        </div>
        <div className="text-xs text-slate-500">{timeStr}</div>
      </div>

      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
    </button>
  );
}

// ==================== HELPER FUNCTIONS ====================

function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

function groupByDate(transactions: PaymentHistoryItem[]): Record<string, PaymentHistoryItem[]> {
  const groups: Record<string, PaymentHistoryItem[]> = {};

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const tx of transactions) {
    const date = new Date(tx.created_at);
    let dateKey: string;

    if (isSameDay(date, today)) {
      dateKey = 'Today';
    } else if (isSameDay(date, yesterday)) {
      dateKey = 'Yesterday';
    } else if (isThisWeek(date)) {
      dateKey = date.toLocaleDateString([], { weekday: 'long' });
    } else if (isThisYear(date)) {
      dateKey = date.toLocaleDateString([], { month: 'long', day: 'numeric' });
    } else {
      dateKey = date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
    }

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(tx);
  }

  return groups;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function isThisWeek(date: Date): boolean {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return date >= weekAgo;
}

function isThisYear(date: Date): boolean {
  return date.getFullYear() === new Date().getFullYear();
}

export default PaymentHistoryScreen;
