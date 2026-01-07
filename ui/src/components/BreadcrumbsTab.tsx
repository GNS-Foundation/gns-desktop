/**
 * BreadcrumbsTab - Proof of Trajectory Collection
 * 
 * Manages GPS breadcrumb collection for handle claiming.
 * Uses @tauri-apps/plugin-geolocation for iOS location.
 * Includes history timeline with details modal.
 */

import { useState, useEffect } from 'react';
import {
  MapPin,
  Clock,
  Zap,
  Settings2,
  ChevronRight,
  Copy,
  Check,
  X,
  History,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface BreadcrumbStatus {
  count: number;
  target: number | null;
  progress_percent: number;
  unique_locations: number;
  first_breadcrumb_at: number | null;
  last_breadcrumb_at: number | null;
  collection_strategy: string;
  collection_enabled: boolean;
  handle_claimed: boolean;
  estimated_completion_at: number | null;
}

interface BreadcrumbRecord {
  h3_cell: string;
  timestamp: number;
  signature: string;
  prev_hash: string | null;
}

// Error Boundary Component
import React from 'react';

class BreadcrumbsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('BreadcrumbsTab crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-slate-400 mb-4">
            {this.state.error?.message || 'Failed to load breadcrumbs'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function BreadcrumbsTab() {
  return (
    <BreadcrumbsErrorBoundary>
      <BreadcrumbsTabContent />
    </BreadcrumbsErrorBoundary>
  );
}

function BreadcrumbsTabContent() {
  const [status, setStatus] = useState<BreadcrumbStatus | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dropping, setDropping] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [selectedBreadcrumb, setSelectedBreadcrumb] = useState<{ record: BreadcrumbRecord; index: number } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Load status on mount and periodically
  useEffect(() => {
    loadStatus();
    loadHistory();
    const interval = setInterval(() => {
      loadStatus();
      loadHistory();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const result = await invoke<BreadcrumbStatus>('get_breadcrumb_status');
      setStatus(result);
      setEnabled(result.collection_enabled);
    } catch (e) {
      console.error('Failed to load breadcrumb status:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const result = await invoke<BreadcrumbRecord[]>('list_breadcrumbs', { limit: 100 });
      if (Array.isArray(result)) {
        setBreadcrumbs(result);
      } else {
        console.warn('list_breadcrumbs returned non-array:', result);
        setBreadcrumbs([]);
      }
    } catch (e) {
      console.error('Failed to load breadcrumb history:', e);
      setBreadcrumbs([]);
    }
  };

  const toggleCollection = async () => {
    try {
      const newEnabled = !enabled;
      setEnabled(newEnabled);
      await invoke('set_collection_enabled', { enabled: newEnabled });
      await loadStatus();
    } catch (e) {
      console.error('Failed to toggle collection:', e);
      setEnabled(!enabled);
    }
  };

  const handleDropNow = async () => {
    setDropping(true);
    try {
      // Get current position using geolocation plugin
      const { getCurrentPosition } = await import('@tauri-apps/plugin-geolocation');
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });

      // Drop breadcrumb via command
      await invoke('drop_breadcrumb', {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });

      // Refresh UI
      setTimeout(() => {
        loadStatus();
        loadHistory();
      }, 500);
    } catch (e) {
      console.error('Failed to drop breadcrumb:', e);
      alert(`Failed to drop breadcrumb: ${e}`);
    } finally {
      setDropping(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    try {
      const date = new Date(timestamp * 1000);
      // Check for invalid date
      if (isNaN(date.getTime())) return 'Invalid Date';

      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      console.error('Date formatting error:', e);
      return 'Error';
    }
  };

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    try {
      const now = Date.now();
      const ts = timestamp * 1000;

      // Check for invalid date or future date (allow small clock skew)
      if (isNaN(ts)) return 'Invalid Date';

      const seconds = Math.floor((now - ts) / 1000);

      if (seconds < 0) return 'Just now'; // Future date handling
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    } catch (e) {
      console.error('TimeAgo formatting error:', e);
      return 'Error';
    }
  };

  const getStrategyLabel = (strategy: string) => {
    switch (strategy) {
      case 'aggressive': return 'Aggressive (30s)';
      case 'motion_aware': return 'Smart (10min)';
      case 'battery_saver': return 'Battery Saver (30min)';
      case 'disabled': return 'Disabled';
      default: return strategy;
    }
  };

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'aggressive': return 'text-green-400';
      case 'motion_aware': return 'text-blue-400';
      case 'battery_saver': return 'text-yellow-400';
      default: return 'text-slate-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const count = status?.count ?? 0;
  const progress = status?.progress_percent ?? 0;

  return (
    <div className="p-4 space-y-6">
      {/* Progress Circle */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-bold text-white">{count}</h2>
            <p className="text-slate-400">breadcrumbs collected</p>
          </div>

          {/* Circular Progress */}
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-slate-700"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${isNaN(progress) ? 0 : progress * 2.51} 251`}
                strokeLinecap="round"
                className="text-blue-500 transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-white">{Math.round(progress)}%</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <MapPin className="w-4 h-4" />
              Unique Locations
            </div>
            <p className="text-xl font-semibold text-white">
              {status?.unique_locations ?? 0}
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Clock className="w-4 h-4" />
              First Collected
            </div>
            <p className="text-xl font-semibold text-white">
              {status?.first_breadcrumb_at
                ? formatDate(status.first_breadcrumb_at).split(',')[0]
                : 'Never'}
            </p>
          </div>
        </div>
      </div>

      {/* Collection Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-white">Collection Settings</h3>
        </div>

        {/* Collection Toggle */}
        <div className="flex items-center justify-between py-3 border-b border-slate-700/50">
          <div>
            <p className="font-medium text-white">Collection Enabled</p>
            <p className="text-sm text-slate-400">
              {enabled ? 'Collecting breadcrumbs in background' : 'Collection paused'}
            </p>
          </div>
          <button
            onClick={toggleCollection}
            className={`w-12 h-7 rounded-full transition-colors relative ${enabled ? 'bg-blue-500' : 'bg-slate-600'}`}
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>

        {/* Strategy */}
        <div className="flex items-center justify-between py-3 border-b border-slate-700/50">
          <div>
            <p className="font-medium text-white">Strategy</p>
            <p className="text-sm text-slate-400">Current collection mode</p>
          </div>
          <span className={`font-medium ${getStrategyColor(status?.collection_strategy ?? 'disabled')}`}>
            {getStrategyLabel(status?.collection_strategy ?? 'disabled')}
          </span>
        </div>

        {/* Last Collected */}
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium text-white">Last Collected</p>
            <p className="text-sm text-slate-400">Most recent breadcrumb</p>
          </div>
          <span className="text-white">
            {formatTimeAgo(status?.last_breadcrumb_at ?? null)}
          </span>
        </div>
      </div>

      {/* Collection Controls */}
      <div className="card p-4">
        <div className="flex gap-3">
          <button
            onClick={toggleCollection}
            className={`flex-1 py-3 rounded-xl font-semibold ${enabled
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-green-500/20 text-green-400 border border-green-500/30'
              }`}
          >
            {enabled ? 'STOP' : 'START'}
          </button>

          <button
            onClick={handleDropNow}
            disabled={dropping}
            className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${dropping
              ? 'bg-blue-500/10 text-blue-400/50 cursor-not-allowed'
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}
          >
            {dropping ? 'DROPPING...' : 'DROP NOW'}
          </button>
        </div>

        {enabled && (
          <div className="mt-3 text-center text-slate-500 text-sm">
            🛰️ Collection running in background
          </div>
        )}
      </div>



      {/* Breadcrumb History */}
      {breadcrumbs.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-semibold text-white">Recent Breadcrumbs</h3>
            </div>
            <span className="text-sm text-slate-500 bg-slate-800 px-2 py-1 rounded">
              {breadcrumbs.length}
            </span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {breadcrumbs.map((bc, index) => {
              const displayIndex = count - index;
              return (
                <button
                  key={`${bc.timestamp}-${index}`}
                  onClick={() => setSelectedBreadcrumb({ record: bc, index: displayIndex })}
                  className="w-full flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-colors text-left"
                >
                  {/* Index Badge */}
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-400">#{displayIndex}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{formatTimeAgo(bc.timestamp)}</span>
                      <span className="text-lg">🍞</span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono truncate">
                      Cell: {bc.h3_cell ? bc.h3_cell.slice(0, 12) : 'Unknown'}...
                    </div>
                  </div>

                  {/* Hash Preview */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-mono text-green-400">
                      {bc.signature.slice(0, 8)}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 ml-auto" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">How It Works</h3>
        </div>

        <p className="text-slate-400 text-sm leading-relaxed">
          Breadcrumbs are cryptographic proofs of your physical location over time.
          They prove you're a real human moving through the world.
        </p>

        <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-500/30">
          <p className="text-blue-400 text-sm">
            <strong>Smart Mode:</strong> Collecting every 10 minutes only when you're
            moving to save battery.
          </p>
        </div>
      </div>

      {/* Handle Claim Progress */}
      {!status?.handle_claimed && count < 100 && (
        <div className="card p-6 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/30">
          <h3 className="font-semibold text-white mb-2">
            🎯 {100 - count} more breadcrumbs to claim your handle
          </h3>
          <p className="text-slate-400 text-sm">
            Keep the app open while moving around to collect breadcrumbs.
            Once you reach 100, you can permanently claim your @handle!
          </p>

          <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Already Claimed */}
      {status?.handle_claimed && (
        <div className="card p-6 bg-green-900/20 border-green-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <span className="text-xl">✓</span>
            </div>
            <div>
              <p className="font-semibold text-green-400">Handle Claimed!</p>
              <p className="text-sm text-green-400/80">
                Your identity is permanently registered on the network
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb Details Modal */}
      {selectedBreadcrumb && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
          <div className="bg-surface w-full max-w-lg rounded-t-2xl max-h-[85vh] overflow-y-auto">
            {/* Handle */}
            <div className="sticky top-0 bg-surface p-4 border-b border-border">
              <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-blue-400">#{selectedBreadcrumb.index}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Breadcrumb Block</h3>
                    <p className="text-sm text-slate-400">{formatTimeAgo(selectedBreadcrumb.record.timestamp)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBreadcrumb(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* H3 Cell */}
              <DetailField
                label="H3 Cell (Location)"
                value={selectedBreadcrumb.record.h3_cell || 'Unknown'}
                onCopy={selectedBreadcrumb.record.h3_cell ? () => copyToClipboard(selectedBreadcrumb.record.h3_cell, 'h3') : undefined}
                copied={copiedField === 'h3'}
              />

              {/* Timestamp */}
              <DetailField
                label="Timestamp"
                value={new Date(selectedBreadcrumb.record.timestamp * 1000).toISOString()}
                onCopy={() => copyToClipboard(selectedBreadcrumb.record.timestamp.toString(), 'timestamp')}
                copied={copiedField === 'timestamp'}
              />

              {/* Signature */}
              <DetailField
                label="Signature"
                value={selectedBreadcrumb.record.signature}
                onCopy={() => copyToClipboard(selectedBreadcrumb.record.signature, 'sig')}
                copied={copiedField === 'sig'}
              />

              {/* Previous Hash */}
              <DetailField
                label="Previous Hash"
                value={selectedBreadcrumb.record.prev_hash || 'Genesis (First Block)'}
                onCopy={selectedBreadcrumb.record.prev_hash
                  ? () => copyToClipboard(selectedBreadcrumb.record.prev_hash!, 'prev')
                  : undefined}
                copied={copiedField === 'prev'}
              />

              {/* Metadata */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Metadata</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
                    🤖 Auto
                  </span>
                  <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm font-medium">
                    📍 H3-7
                  </span>
                </div>
              </div>

              {/* Chain Integrity */}
              <div className="p-3 bg-green-900/20 rounded-lg border border-green-500/30">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-sm font-medium">Chain Link Verified</span>
                </div>
                <p className="text-xs text-green-400/70 mt-1">
                  This breadcrumb is cryptographically linked to your identity chain
                </p>
              </div>
            </div>

            {/* Close Button */}
            <div className="p-4 border-t border-slate-800">
              <button
                onClick={() => setSelectedBreadcrumb(null)}
                className="w-full py-3 bg-slate-800 text-white rounded-xl font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Detail Field Component
function DetailField({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm text-white font-mono break-all bg-slate-800/50 p-2 rounded">
          {value}
        </p>
        {onCopy && (
          <button
            onClick={onCopy}
            className="p-2 text-slate-400 hover:text-white transition-colors flex-shrink-0"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
