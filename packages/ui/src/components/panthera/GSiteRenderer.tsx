// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — gSite Renderer (Fixed to match Tauri Desktop)
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/GSiteRenderer.tsx
//
// Fixed issues:
//   - Cover gradient now uses Tailwind classes (inline styles were stripped)
//   - Avatar card is larger and properly styled
//   - Message button is always visible
//   - Facets discovery actually runs and renders
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  MessageCircle, CreditCard, Copy,
  ExternalLink, MapPin, Globe, Clock, CheckCircle,
  User, Check, Key,
} from 'lucide-react';

const API_BASE = 'https://gns-browser-production.up.railway.app';

// ─── Helpers ───

function formatTrustScore(raw: number): string {
  // API returns trust_score as 0–100 float (e.g. 95.89)
  // Clamp to reasonable range and format
  const score = Math.min(raw, 100);
  return `${score.toFixed(1)}%`;
}

function formatBreadcrumbs(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
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
  const [facetsLoaded, setFacetsLoaded] = useState(false);

  const pk = profile?.publicKey || profile?.public_key || '';
  const trustScore = profile?.trustScore || 0;
  const breadcrumbs = profile?.breadcrumbCount || 0;
  const handle = profile?.handle || '';

  // ─── Fetch facets on mount ───
  useEffect(() => {
    if (!handle || facetsLoaded) return;

    const discoverFacets = async () => {
      const possiblePrefixes = ['work', 'friends', 'public', 'commerce', 'anonymous'];
      const found: string[] = [];

      for (const prefix of possiblePrefixes) {
        try {
          const res = await fetch(`${API_BASE}/handles/${prefix}%40${handle}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              found.push(`${prefix}@${handle}`);
            }
          }
        } catch {
          // Ignore errors
        }
      }

      setFacets(found);
      setFacetsLoaded(true);
    };

    discoverFacets();
  }, [handle, facetsLoaded]);

  // ─── Copy public key ───
  const copyPk = () => {
    navigator.clipboard?.writeText(pk);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto pb-24">
      {/* ═══ Cover Gradient ═══ */}
      <div 
        className="h-48 md:h-56 w-full"
        style={{
          background: profile.coverImage 
            ? `url(${profile.coverImage}) center/cover`
            : 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 25%, #ddd6fe 50%, #e9d5ff 75%, #f3e8ff 100%)',
        }}
      />

      {/* ═══ Avatar Card (centered, overlapping cover) ═══ */}
      <div className="flex justify-center -mt-20 relative z-10">
        <div className="w-32 h-32 rounded-2xl bg-white shadow-xl border border-gray-200 flex items-center justify-center overflow-hidden">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={handle}
              className="w-full h-full object-cover"
            />
          ) : (
            <User size={56} className="text-blue-400" strokeWidth={1.5} />
          )}
        </div>
      </div>

      {/* ═══ Profile Content ═══ */}
      <div className="px-6 mt-6">
        {/* Name + Handle + Message Button Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Name with verified badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {profile.displayName || handle}
              </h1>
              {profile.isVerified && (
                <CheckCircle size={20} className="text-cyan-500 flex-shrink-0" />
              )}
            </div>

            {/* @handle */}
            <p className="text-cyan-600 font-medium mt-1">
              @{handle}
            </p>

            {/* Entity type */}
            <div className="flex items-center gap-1.5 mt-2 text-gray-500">
              <User size={14} />
              <span className="text-sm">person</span>
            </div>
          </div>

          {/* Prominent Message button */}
          <button
            onClick={() => onMessage?.(profile)}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-purple-500 hover:bg-purple-600 text-white font-medium shadow-lg transition-all flex-shrink-0"
          >
            <MessageCircle size={18} />
            <span>Message</span>
          </button>
        </div>

        {/* ═══ Trust Score + Breadcrumbs ═══ */}
        <div className="flex items-baseline gap-6 mt-6">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {formatTrustScore(trustScore)}
            </span>
            <span className="text-sm text-gray-500">Trust Score</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {formatBreadcrumbs(breadcrumbs)}
            </span>
            <span className="text-sm text-gray-500">Breadcrumbs</span>
          </div>
        </div>

        {/* ═══ Bio ═══ */}
        {profile.bio && (
          <p className="mt-4 text-gray-600 leading-relaxed">
            {profile.bio}
          </p>
        )}

        {/* ═══ Public Key Card ═══ */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Key size={14} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Public Key
              </span>
            </div>
            <button
              onClick={copyPk}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors text-gray-500"
            >
              {copied ? (
                <Check size={12} className="text-green-500" />
              ) : (
                <Copy size={12} />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <code className="text-xs text-gray-600 font-mono break-all leading-relaxed block">
            {pk}
          </code>
        </div>

        {/* ═══ Facets ═══ */}
        {facets.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Facets
            </h3>
            <div className="flex flex-wrap gap-2">
              {facets.map((facet, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate(`@${facet}`)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors border border-gray-200"
                >
                  {facet}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Secondary Actions ═══ */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-gray-200">
          <button
            onClick={() => onPay?.(profile)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            <CreditCard size={16} />
            Pay
          </button>
          <button
            onClick={() => navigator.clipboard?.writeText(`@${handle}`)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            <Copy size={16} />
            Copy @
          </button>
          <button
            onClick={() => navigator.clipboard?.writeText(
              `https://panthera.gcrumbs.com/@${handle}`
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
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
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
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              TrIP Trajectory
            </h3>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="font-bold text-gray-800">
                  {profile.epochRoots.length}
                </span>
                <span className="text-gray-500 ml-1">epochs</span>
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
      </div>
    </div>
  );
}
