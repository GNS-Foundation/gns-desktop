/**
 * Breadcrumbs Tab - Location proof collection status
 */

import { useState } from 'react';
import { MapPin, Clock, Battery, Zap, Settings2 } from 'lucide-react';
import { useBreadcrumbStatus, setCollectionEnabled } from '../lib/tauri';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

export function BreadcrumbsTab() {
  const { status, loading, refresh } = useBreadcrumbStatus();
  const [toggling, setToggling] = useState(false);

  const handleToggleCollection = async () => {
    if (!status) return;
    
    try {
      setToggling(true);
      await setCollectionEnabled(!status.collection_enabled);
      await refresh();
    } catch (e) {
      console.error('Failed to toggle collection:', e);
    } finally {
      setToggling(false);
    }
  };

  if (loading || !status) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const strategyLabel = {
    aggressive: 'Aggressive (30s)',
    motion_aware: 'Smart (10min)',
    battery_saver: 'Battery Saver (30min)',
    disabled: 'Disabled',
    desktop: 'Not Available',
  }[status.collection_strategy] || status.collection_strategy;

  return (
    <div className="p-4 space-y-6">
      {/* Progress Card */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{status.count}</h1>
            <p className="text-slate-400">
              {status.target
                ? `of ${status.target} breadcrumbs`
                : 'breadcrumbs collected'}
            </p>
          </div>

          <div className="w-20 h-20 relative">
            {/* Progress ring */}
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-slate-700"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${2 * Math.PI * 36 * (1 - status.progress_percent / 100)}`}
                className="text-blue-500 transition-all duration-500"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold">
                {Math.round(status.progress_percent)}%
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Stat
            icon={<MapPin className="w-4 h-4" />}
            label="Unique Locations"
            value={status.unique_locations.toString()}
          />
          <Stat
            icon={<Clock className="w-4 h-4" />}
            label="First Collected"
            value={
              status.first_breadcrumb_at
                ? formatDistanceToNow(new Date(status.first_breadcrumb_at * 1000), {
                    addSuffix: true,
                  })
                : 'Never'
            }
          />
        </div>
      </div>

      {/* Collection Settings */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Settings2 className="w-5 h-5" />
          Collection Settings
        </h2>

        {/* Toggle */}
        <div className="flex items-center justify-between py-3 border-b border-slate-700">
          <div>
            <p className="font-medium">Collection Enabled</p>
            <p className="text-slate-400 text-sm">
              {status.collection_enabled
                ? 'Collecting breadcrumbs in background'
                : 'Collection paused'}
            </p>
          </div>
          <button
            onClick={handleToggleCollection}
            disabled={toggling || status.collection_strategy === 'desktop'}
            className={clsx(
              'w-14 h-8 rounded-full transition-colors relative',
              status.collection_enabled ? 'bg-blue-600' : 'bg-slate-700',
              (toggling || status.collection_strategy === 'desktop') && 'opacity-50'
            )}
          >
            <div
              className={clsx(
                'w-6 h-6 rounded-full bg-white absolute top-1 transition-transform',
                status.collection_enabled ? 'translate-x-7' : 'translate-x-1'
              )}
            />
          </button>
        </div>

        {/* Strategy */}
        <div className="flex items-center justify-between py-3 border-b border-slate-700">
          <div>
            <p className="font-medium">Strategy</p>
            <p className="text-slate-400 text-sm">Current collection mode</p>
          </div>
          <span className="text-blue-400 text-sm">{strategyLabel}</span>
        </div>

        {/* Last collection */}
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium">Last Collected</p>
            <p className="text-slate-400 text-sm">Most recent breadcrumb</p>
          </div>
          <span className="text-slate-300 text-sm">
            {status.last_breadcrumb_at
              ? formatDistanceToNow(new Date(status.last_breadcrumb_at * 1000), {
                  addSuffix: true,
                })
              : 'Never'}
          </span>
        </div>
      </div>

      {/* Strategy Explanation */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          How It Works
        </h2>

        <div className="space-y-4 text-sm text-slate-400">
          <p>
            Breadcrumbs are cryptographic proofs of your physical location over time.
            They prove you're a real human moving through the world.
          </p>

          {!status.handle_claimed && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
              <p className="text-blue-400">
                <strong>New User Mode:</strong> Collecting every 30 seconds to help
                you reach 100 breadcrumbs faster.
              </p>
            </div>
          )}

          {status.handle_claimed && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
              <p className="text-green-400">
                <strong>Smart Mode:</strong> Collecting every 10 minutes only when
                you're moving to save battery.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3">
      <div className="flex items-center gap-2 text-slate-500 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-medium">{value}</p>
    </div>
  );
}
