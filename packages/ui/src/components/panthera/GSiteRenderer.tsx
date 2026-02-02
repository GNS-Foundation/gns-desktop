// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — gSite Renderer (Upgraded to match Tauri Desktop)
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/GSiteRenderer.tsx
//
// Renders GNS identity profiles matching the Tauri desktop layout:
//   - Soft gradient cover (lavender/cyan)
//   - Square avatar card overlapping cover
//   - Name + verified ✓ + prominent Message button
//   - Entity type badge (person)
//   - Trust Score + Breadcrumbs (formatted)
//   - Public Key card with Copy
//   - Facets section (work@, friends@, etc.)
//   - Modules, Epoch/Trajectory, Member-since
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, MessageCircle, CreditCard, Copy,
  ExternalLink, MapPin, Globe, Clock, CheckCircle,
  User, Check, Key,
} from 'lucide-react';

const API_BASE = 'https://gns-browser-production.up.railway.app';

// ─── Helpers ───

function formatTrustScore(raw: number): string {
  // API returns trust_score as 0–100 float
  // But sometimes it comes as e.g. 95.89041095890411
  if (raw > 100) {
    // It's stored as breadcrumb_ratio * 100 or some raw form
    return `${(raw / 100).toFixed(1)}%`;
  }
  return `${raw.toFixed(1)}%`;
}

function formatBreadcrumbs(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

function getTrustColor(score: number): string {
  if (score >= 76) return '#3b82f6'; // blue
  if (score >= 51) return '#22c55e'; // green
  if (score >= 26) return '#f59e0b'; // amber
  return '#9ca3af'; // gray
}

// ─── Types ───

interface GSiteRendererProps {
  profile: any;
  gsite?: any;
  onNavigate: (input: string) => void;
  onMessage?: (profile: any) => void;
  onPay?: (profile: any) => void;
}

export default function GSiteRenderer({
  profile,
  gsite,
  onNavigate,
  onMessage,
  onPay,
}: GSiteRendererProps) {
  const [copied, setCopied] = useState(false);
  const [facets, setFacets] = useState<string[]>([]);

  if (!profile) return null;

  const pk = profile.publicKey || profile.public_key || '';
  const trustScore = profile.trustScore || 0;
  const breadcrumbs = profile.breadcrumbCount || 0;
  const trustColor = getTrustColor(trustScore);

  // ─── Fetch facets ───
  useEffect(() => {
    if (!profile.handle) return;
    // Try to discover facets for this identity
    const possibleFacets = ['work', 'friends', 'public', 'commerce', 'anonymous'];
    const discovered: string[] = [];

    const checkFacet = async (prefix: string) => {
      try {
        const res = await fetch(`${API_BASE}/handles/${prefix}@${profile.handle}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) discovered.push(`${prefix}@${profile.handle}`);
        }
      } catch {}
    };

    Promise.all(possibleFacets.map(checkFacet)).then(() => {
      if (discovered.length > 0) setFacets(discovered);
    });
  }, [profile.handle]);

  // ─── Copy public key ───
  const copyPk = () => {
    navigator.clipboard?.writeText(pk);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* ═══ Cover Gradient ═══ */}
      <div className="relative h-44 md:h-52 overflow-hidden">
        {profile.coverImage ? (
          <img
            src={profile.coverImage}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 25%, #ddd6fe 50%, #e9d5ff 75%, #f3e8ff 100%)',
            }}
          />
        )}
      </div>

      {/* ═══ Avatar Card (overlapping cover) ═══ */}
      <div className="px-6 -mt-16 relative z-10">
        <div className="w-28 h-28 rounded-2xl bg-white shadow-lg border border-gray-100 flex items-center justify-center overflow-hidden">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.handle}
              className="w-full h-full object-cover"
            />
          ) : (
            <User size={48} className="text-gray-400" />
          )}
        </div>
      </div>

      {/* ═══ Name + Handle + Message Button ═══ */}
      <div className="px-6 mt-4">
        <div className="flex items-start justify-between">
          <div>
            {/* Name with verified badge */}
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {profile.displayName || profile.handle}
              </h1>
              {profile.isVerified && (
                <CheckCircle size={20} className="text-cyan-500" />
              )}
            </div>

            {/* @handle */}
            <span className="text-cyan-600 font-medium text-base">
              @{profile.handle}
            </span>

            {/* Entity type */}
            <div className="flex items-center gap-1.5 mt-2">
              <User size={14} className="text-gray-400" />
              <span className="text-sm text-gray-500">person</span>
            </div>
          </div>

          {/* Prominent Message button */}
          <button
            onClick={() => onMessage?.(profile)}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-lg transition-all hover:shadow-xl"
          >
            <MessageCircle size={18} />
            Message
          </button>
        </div>

        {/* ═══ Trust Score + Breadcrumbs ═══ */}
        <div className="flex items-center gap-8 mt-6">
          <div>
            <span className="text-3xl font-bold text-gray-900">
              {formatTrustScore(trustScore)}
            </span>
            <span className="text-sm text-gray-500 ml-2">Trust Score</span>
          </div>
          <div>
            <span className="text-3xl font-bold text-gray-900">
              {formatBreadcrumbs(breadcrumbs)}
            </span>
            <span className="text-sm text-gray-500 ml-2">Breadcrumbs</span>
          </div>
        </div>

        {/* ═══ Bio ═══ */}
        {profile.bio && (
          <p className="mt-4 text-gray-600 leading-relaxed max-w-xl">
            {profile.bio}
          </p>
        )}

        {/* ═══ Public Key Card ═══ */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Key size={14} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Public Key
              </span>
            </div>
            <button
              onClick={copyPk}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors text-gray-500"
            >
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <code className="text-xs text-gray-600 font-mono break-all leading-relaxed">
            {pk}
          </code>
        </div>

        {/* ═══ Facets ═══ */}
        {facets.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Facets
            </h3>
            <div className="flex flex-wrap gap-2">
              {facets.map((facet, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate(`@${facet}`)}
                  className="px-4 py-2 bg-purple-100 hover:bg-purple-200 rounded-xl text-sm font-medium text-purple-700 transition-colors"
                >
                  {facet}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Secondary Actions ═══ */}
        <div className="flex items-center gap-2 mt-6 pb-5 border-b border-gray-200">
          <button
            onClick={() => onPay?.(profile)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            <CreditCard size={16} />
            Pay
          </button>
          <button
            onClick={() => navigator.clipboard?.writeText(`@${profile.handle}`)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            <Copy size={16} />
            Copy @
          </button>
          <button
            onClick={() => navigator.clipboard?.writeText(
              `https://panthera.gcrumbs.com/@${profile.handle}`
            )}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            <ExternalLink size={16} />
            Share
          </button>
        </div>

        {/* Location */}
        {profile.location && (
          <div className="flex items-center gap-2 mt-4 text-sm text-gray-500">
            <MapPin size={15} />
            <span>{profile.location}</span>
          </div>
        )}

        {/* Website → Legacy Web navigation */}
        {profile.website && (
          <div className="flex items-center gap-2 mt-2 text-sm">
            <Globe size={15} className="text-gray-400" />
            <button
              onClick={() => onNavigate(profile.website)}
              className="text-cyan-600 hover:underline"
            >
              {profile.website.replace(/^https?:\/\//, '')}
            </button>
          </div>
        )}

        {/* ═══ Modules ═══ */}
        {profile.modules && profile.modules.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Modules
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.modules.map((m: any, i: number) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600"
                >
                  {m.schema?.split('/')[0]?.replace('gns.module.', '') || 'module'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Epoch / Trajectory ═══ */}
        {profile.epochRoots && profile.epochRoots.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              TrIP Trajectory
            </h3>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="font-bold text-gray-800">
                  {profile.epochRoots.length}
                </span>
                <span className="text-gray-500 ml-1">epochs published</span>
              </div>
              <div>
                <span className="font-bold text-gray-800">
                  {formatBreadcrumbs(breadcrumbs)}
                </span>
                <span className="text-gray-500 ml-1">breadcrumbs</span>
              </div>
            </div>
          </div>
        )}

        {/* Member since */}
        {profile.createdAt && (
          <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
            <Clock size={13} />
            <span>
              Identity created{' '}
              {new Date(profile.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        )}

        <div className="h-24" />
      </div>
    </div>
  );
}
