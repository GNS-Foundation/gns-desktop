// ===========================================
// GNS BROWSER - TRAJECTORY SECTION (PHASE 2)
// ===========================================
// Visual display of proof-of-trajectory stats

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Flame,
  Globe,
  Calendar,
  Map,
  ChevronDown,
  ChevronUp,
  Trophy,
  TrendingUp,
  Clock,
} from 'lucide-react';
import {
  TrajectoryStats,
  EMPTY_TRAJECTORY,
  getStreakEmoji,
  getStreakLabel,
  formatPercentage,
} from '../../types/trajectory';
import { getTrajectoryStats } from '../../lib/trajectory';

// ===========================================
// PROPS
// ===========================================

interface TrajectorySectionProps {
  handle: string;
  isOwnProfile: boolean;
  // Optional: Pass in already-loaded stats
  initialStats?: TrajectoryStats;
  // Compact mode for inline display
  compact?: boolean;
  // Callback when user wants to see map
  onViewMap?: () => void;
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function TrajectorySection({
  handle,
  isOwnProfile,
  initialStats,
  compact = false,
  onViewMap,
}: TrajectorySectionProps) {
  const [stats, setStats] = useState<TrajectoryStats>(initialStats || EMPTY_TRAJECTORY);
  const [loading, setLoading] = useState(!initialStats);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!initialStats) {
      loadStats();
    }
  }, [handle, isOwnProfile]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);

    const result = await getTrajectoryStats(handle, isOwnProfile);

    setLoading(false);

    if (result.success && result.stats) {
      setStats(result.stats);
    } else {
      setError(result.error || 'Failed to load trajectory');
    }
  };

  // Compact mode (just stats grid)
  if (compact) {
    return (
      <CompactStats
        stats={stats}
        loading={loading}
        isOwnProfile={isOwnProfile}
      />
    );
  }

  return (
    <div className="bg-[#161B22] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <MapPin size={18} className="text-blue-400" />
          Trajectory
        </h3>
        <span className="text-xs text-green-400 px-2 py-0.5 bg-green-500/10 rounded font-medium">
          PROOF
        </span>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState error={error} onRetry={loadStats} />
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2">
              <StatBox
                value={stats.totalBreadcrumbs}
                label="crumbs"
                icon={<MapPin size={14} className="text-blue-400" />}
              />
              <StatBox
                value={stats.uniqueCells || Math.floor(stats.totalBreadcrumbs * 0.7)}
                label="places"
                icon={<Globe size={14} className="text-purple-400" />}
              />
              <StatBox
                value={formatAge(stats.accountAgeDays)}
                label="active"
                icon={<Clock size={14} className="text-green-400" />}
              />
              <StatBox
                value={stats.activeDays || stats.accountAgeDays}
                label="days"
                icon={<Calendar size={14} className="text-yellow-400" />}
              />
            </div>

            {/* Streak Display */}
            <StreakDisplay
              current={stats.currentStreak}
              longest={stats.longestStreak}
              lastActive={stats.lastActiveDate}
            />

            {/* Countries (if available) */}
            {stats.countries.length > 0 && (
              <CountriesDisplay countries={stats.countries} />
            )}

            {/* Expandable Details */}
            {isOwnProfile && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-2 py-2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <span className="text-sm">
                  {expanded ? 'Less details' : 'More details'}
                </span>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}

            {/* Expanded Details */}
            {expanded && (
              <ExpandedDetails
                stats={stats}
                onViewMap={onViewMap}
              />
            )}

            {/* Limited Data Notice (for other profiles) */}
            {!isOwnProfile && stats.countries.length === 0 && (
              <div className="text-center text-gray-500 text-xs py-2">
                🔒 Detailed trajectory is private
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ===========================================
// STAT BOX
// ===========================================

interface StatBoxProps {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}

function StatBox({ value, label, icon, highlight }: StatBoxProps) {
  return (
    <div
      className={`text-center p-3 rounded-lg transition-colors ${highlight
        ? 'bg-blue-500/20 border border-blue-500/30'
        : 'bg-[#21262D]'
        }`}
    >
      {icon && <div className="flex justify-center mb-1">{icon}</div>}
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

// ===========================================
// COMPACT STATS (for inline use)
// ===========================================

function CompactStats({
  stats,
  loading,
}: {
  stats: TrajectoryStats;
  loading: boolean;
  isOwnProfile: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <div className="animate-pulse bg-gray-700 rounded h-4 w-20" />
        <div className="animate-pulse bg-gray-700 rounded h-4 w-16" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-gray-400">
        📍 {stats.totalBreadcrumbs} crumbs
      </span>
      {stats.currentStreak > 0 && (
        <span className="text-orange-400">
          🔥 {stats.currentStreak} day streak
        </span>
      )}
      {stats.countries.length > 0 && (
        <span className="text-gray-400">
          🌍 {stats.countries.length} countries
        </span>
      )}
    </div>
  );
}

// ===========================================
// STREAK DISPLAY
// ===========================================

function StreakDisplay({
  current,
  longest,
  lastActive,
}: {
  current: number;
  longest: number;
  lastActive: string;
}) {
  const isActiveToday = lastActive
    ? new Date(lastActive).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
    : false;

  return (
    <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg p-3 border border-orange-500/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame
            size={20}
            className={current > 0 ? 'text-orange-400' : 'text-gray-500'}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">
                {current > 0 ? `${current} day streak` : 'No active streak'}
              </span>
              <span className="text-lg">{getStreakEmoji(current)}</span>
            </div>
            <div className="text-xs text-gray-500">
              {getStreakLabel(current)}
              {longest > current && ` • Best: ${longest} days`}
            </div>
          </div>
        </div>

        {isActiveToday && (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded-full">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-400">Active</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================
// COUNTRIES DISPLAY
// ===========================================

function CountriesDisplay({ countries }: { countries: TrajectoryStats['countries'] }) {
  const topCountries = countries.slice(0, 5);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Globe size={14} />
        <span>Top locations</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {topCountries.map((country) => (
          <div
            key={country.code}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#21262D] rounded-lg"
          >
            <span className="text-lg">{country.flag}</span>
            <span className="text-white text-sm">{country.name}</span>
            <span className="text-gray-500 text-xs">
              {formatPercentage(country.percentage)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================
// EXPANDED DETAILS
// ===========================================

function ExpandedDetails({
  stats,
  onViewMap,
}: {
  stats: TrajectoryStats;
  onViewMap?: () => void;
}) {
  return (
    <div className="space-y-4 pt-3 border-t border-white/5">
      {/* Additional Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#21262D] rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <TrendingUp size={14} />
            <span>Activity Rate</span>
          </div>
          <div className="text-white font-semibold">
            {stats.accountAgeDays > 0
              ? (stats.activeDays / stats.accountAgeDays * 100).toFixed(0)
              : 0}%
          </div>
          <div className="text-xs text-gray-500">
            Active {stats.activeDays} of {stats.accountAgeDays} days
          </div>
        </div>

        <div className="bg-[#21262D] rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Trophy size={14} />
            <span>Best Streak</span>
          </div>
          <div className="text-white font-semibold">
            {stats.longestStreak} days
          </div>
          <div className="text-xs text-gray-500">
            {stats.longestStreak >= 30
              ? 'Impressive!'
              : stats.longestStreak >= 7
                ? 'Keep building!'
                : 'Room to grow'}
          </div>
        </div>
      </div>

      {/* View Map Button */}
      {onViewMap && (
        <button
          onClick={onViewMap}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
        >
          <Map size={18} />
          <span>View Trajectory Map</span>
        </button>
      )}

      {/* First Breadcrumb Date */}
      {stats.firstBreadcrumbAt && (
        <div className="text-center text-xs text-gray-500">
          First breadcrumb: {new Date(stats.firstBreadcrumbAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      )}
    </div>
  );
}

// ===========================================
// LOADING SKELETON
// ===========================================

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#21262D] rounded-lg h-16" />
        ))}
      </div>
      <div className="bg-[#21262D] rounded-lg h-14" />
    </div>
  );
}

// ===========================================
// ERROR STATE
// ===========================================

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="text-center py-4">
      <div className="text-gray-500 text-sm mb-2">{error}</div>
      <button
        onClick={onRetry}
        className="text-blue-400 text-sm hover:underline"
      >
        Try again
      </button>
    </div>
  );
}

// ===========================================
// HELPERS
// ===========================================

function formatAge(days: number): string {
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

// ===========================================
// EXPORT
// ===========================================

export default TrajectorySection;
