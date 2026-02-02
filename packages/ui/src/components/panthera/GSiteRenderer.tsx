// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — gSite Renderer
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/GSiteRenderer.tsx
//
// Renders GNS identity profiles and gSites within PANTHERA.
// Shows: cover image, avatar, handle, bio, trust badge,
// action buttons (message, pay, copy, share), modules,
// epoch/trajectory data, and member-since.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import {
  ShieldCheck, MessageCircle, CreditCard, Copy,
  ExternalLink, MapPin, Globe, Clock, CheckCircle,
} from 'lucide-react';
import TrustBadge, { getTrustColor, getTrustLabel } from './TrustBadge';

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
  if (!profile) return null;

  const trustColor = getTrustColor(profile.trustScore || 0);

  const actions = [
    {
      icon: MessageCircle,
      label: 'Message',
      onClick: () => onMessage?.(profile),
      primary: true,
    },
    {
      icon: CreditCard,
      label: 'Pay',
      onClick: () => onPay?.(profile),
    },
    {
      icon: Copy,
      label: 'Copy @',
      onClick: () => navigator.clipboard?.writeText(`@${profile.handle}`),
    },
    {
      icon: ExternalLink,
      label: 'Share',
      onClick: () => navigator.clipboard?.writeText(
        `https://gnamesystem.netlify.app/@${profile.handle}`
      ),
    },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* ─── Cover ─── */}
      <div className="relative h-48 md:h-56 bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-b-2xl overflow-hidden">
        {profile.coverImage && (
          <img
            src={profile.coverImage}
            alt=""
            className="w-full h-full object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Trust badge on cover */}
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm">
            <ShieldCheck size={14} style={{ color: trustColor }} />
            <span className="text-xs font-semibold text-white">
              {getTrustLabel(profile.trustScore || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Profile Header ─── */}
      <div className="px-6 -mt-16 relative z-10">
        {/* Avatar */}
        <div className="w-28 h-28 rounded-2xl border-4 border-white shadow-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center overflow-hidden">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.handle}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-4xl font-bold text-white">
              {(profile.displayName || profile.handle || '?')[0].toUpperCase()}
            </span>
          )}
        </div>

        {/* Name & handle */}
        <div className="mt-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {profile.displayName || profile.handle}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-cyan-600 font-semibold">@{profile.handle}</span>
            {profile.isVerified && (
              <CheckCircle size={16} className="text-cyan-500" />
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-3 text-gray-600 leading-relaxed max-w-xl">
            {profile.bio}
          </p>
        )}

        {/* Trust section */}
        <div className="mt-4">
          <TrustBadge
            score={profile.trustScore}
            breadcrumbs={profile.breadcrumbCount}
            verified={profile.isVerified}
          />
        </div>

        {/* ─── Action Bar ─── */}
        <div className="flex items-center gap-2 mt-5 pb-5 border-b border-gray-200">
          {actions.map((a, i) => {
            const Icon = a.icon;
            return (
              <button
                key={i}
                onClick={a.onClick}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  a.primary
                    ? 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-sm'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <Icon size={16} />
                {a.label}
              </button>
            );
          })}
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

        {/* ─── Modules ─── */}
        {profile.modules && profile.modules.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Modules
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.modules.map((m: any, i: number) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600"
                >
                  {m.schema?.split('/')[0]?.replace('gns.module.', '') || 'module'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ─── Epoch / Trajectory ─── */}
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
                  {profile.breadcrumbCount || 0}
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
