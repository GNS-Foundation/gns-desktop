// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — Trust Badge & Theme Utilities
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/TrustBadge.tsx
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { ShieldCheck, Shield } from 'lucide-react';

// ─── Trust score thresholds ───

export function getTrustColor(score: number): string {
  if (score >= 80) return '#06b6d4'; // cyan-500 — Verified
  if (score >= 50) return '#10b981'; // emerald-500 — High
  if (score >= 25) return '#f59e0b'; // amber-500 — Medium
  return '#9ca3af';                  // gray-400 — New
}

export function getTrustLabel(score: number): string {
  if (score >= 80) return 'Verified';
  if (score >= 50) return 'High Trust';
  if (score >= 25) return 'Medium';
  return 'New';
}

// ─── Component ───

interface TrustBadgeProps {
  score?: number;
  breadcrumbs?: number;
  verified?: boolean;
  compact?: boolean;
}

export default function TrustBadge({
  score = 0,
  breadcrumbs,
  verified,
  compact = false,
}: TrustBadgeProps) {
  const color = getTrustColor(score);
  const label = getTrustLabel(score);

  if (compact) {
    return (
      <div className="flex items-center gap-1" style={{ color }}>
        <Shield size={12} />
        <span className="text-[10px] font-semibold">{label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-1" style={{ color }}>
        {verified ? <ShieldCheck size={16} /> : <Shield size={16} />}
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <span className="text-xs text-gray-400">
        {score}%
      </span>
      {breadcrumbs != null && (
        <span className="text-[10px] text-gray-400">
          · {breadcrumbs.toLocaleString()} crumbs
        </span>
      )}
    </div>
  );
}
