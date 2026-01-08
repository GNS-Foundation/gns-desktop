// ===========================================
// GNS BROWSER - TRUST BADGE COMPONENT
// ===========================================
// Visual representation of trust score

// import React from 'react';
import { Shield, ShieldCheck, CheckCircle, BadgeCheck, MapPin, Calendar } from 'lucide-react';
import { TrustInfo, getTrustColor, getTrustLabel } from '../../types/gsite';

interface TrustBadgeProps {
  trust: TrustInfo;
  compact?: boolean;
}

export function TrustBadge({ trust, compact = false }: TrustBadgeProps) {
  const color = getTrustColor(trust.score);
  const label = getTrustLabel(trust.score);

  const Icon = trust.score >= 76
    ? BadgeCheck
    : trust.score >= 51
      ? CheckCircle
      : trust.score >= 26
        ? ShieldCheck
        : Shield;

  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{
          backgroundColor: `${color}15`,
          border: `1px solid ${color}30`,
        }}
      >
        <Icon size={14} style={{ color }} />
        <span className="text-xs font-bold" style={{ color }}>
          {Math.round(trust.score)}
        </span>
      </div>
    );
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: `${color}10`,
        border: `1px solid ${color}25`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={20} style={{ color }} />
          <span className="font-medium" style={{ color }}>Trust Score</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold" style={{ color }}>
            {Math.round(trust.score)}
          </span>
          <span className="text-sm text-gray-500">/100</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-black/10 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${trust.score}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Label */}
      <div
        className="text-center text-sm font-medium mb-3 py-1 rounded-lg"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {label}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-1.5">
          <MapPin size={14} />
          <span>{trust.breadcrumbs} breadcrumbs</span>
        </div>
        {trust.since && (
          <div className="flex items-center gap-1.5">
            <Calendar size={14} />
            <span>Since {formatDate(trust.since)}</span>
          </div>
        )}
      </div>

      {/* Verifications */}
      {trust.verifications && trust.verifications.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-xs text-gray-400 mb-2">VERIFIED</div>
          <div className="flex flex-wrap gap-2">
            {trust.verifications.map((v, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 rounded-lg text-xs"
              >
                <CheckCircle size={12} />
                <span>{v.provider}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================
// COMPACT TRUST INDICATOR
// ===========================================

interface TrustIndicatorProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function TrustIndicator({ score, size = 'md' }: TrustIndicatorProps) {
  const color = getTrustColor(score);

  const sizes = {
    sm: { badge: 'w-5 h-5', text: 'text-[10px]' },
    md: { badge: 'w-7 h-7', text: 'text-xs' },
    lg: { badge: 'w-9 h-9', text: 'text-sm' },
  };

  return (
    <div
      className={`${sizes[size].badge} rounded-full flex items-center justify-center font-bold`}
      style={{ backgroundColor: color }}
      title={`Trust Score: ${Math.round(score)}`}
    >
      <span className={`${sizes[size].text} text-white`}>
        {Math.round(score)}
      </span>
    </div>
  );
}

export default TrustBadge;
