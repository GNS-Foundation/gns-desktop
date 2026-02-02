// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — gSite Renderer (Matches Tauri ProfileView)
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/GSiteRenderer.tsx
//
// Ported from Tauri App.js ProfileView component.
// Facets are hardcoded as ['work', 'friends', 'public'] to match
// the Tauri desktop experience.
//
// Goal: Desktop (Tauri) = Web (PANTHERA) = same React codebase
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  MessageCircle, Copy, Check, ExternalLink,
  User, Building, MapPin, Package,
} from 'lucide-react';

// ─── Type Icons (matches Tauri) ───
const TYPE_ICONS: Record<string, React.ElementType> = {
  person: User,
  organization: Building,
  landmark: MapPin,
  bot: Package,
};

// ─── Hardcoded Facets (matches Tauri) ───
const DEFAULT_FACETS = ['work', 'friends', 'public'];

// ─── Types ───

interface GSiteRendererProps {
  profile: any;
  gsite?: any;
  onNavigate: (input: string) => void;
  onMessage?: (profile: any) => void;
  onPay?: (profile: any) => void;
  darkMode?: boolean;
}

export default function GSiteRenderer({
  profile,
  gsite,
  onNavigate,
  onMessage,
  onPay,
  darkMode = false,
}: GSiteRendererProps) {
  const [copiedKey, setCopiedKey] = useState(false);

  if (!profile) return null;

  // Extract data
  const handle = profile.handle || '';
  const name = profile.displayName || profile.name || handle;
  const pk = profile.publicKey || profile.public_key || '';
  const color = profile.color || '#0EA5E9'; // cyan default
  const type = profile.type || 'person';
  const TypeIcon = TYPE_ICONS[type] || User;
  const isVerified = profile.isVerified || profile.stats?.verified || false;
  
  // Trust & breadcrumbs
  const trustScore = profile.trustScore || profile.stats?.trustScore || 0;
  const breadcrumbs = profile.breadcrumbCount || profile.stats?.breadcrumbs || 0;
  
  // Format for display
  const trustDisplay = typeof trustScore === 'number' 
    ? `${Math.min(trustScore, 100).toFixed(1)}%`
    : trustScore;
  const breadcrumbDisplay = typeof breadcrumbs === 'number'
    ? (breadcrumbs >= 1000 ? `${(breadcrumbs / 1000).toFixed(1)}K` : breadcrumbs.toString())
    : breadcrumbs;

  // Theme (matches Tauri)
  const theme = {
    bg: darkMode ? 'bg-gray-900' : 'bg-white',
    bgSecondary: darkMode ? 'bg-gray-800' : 'bg-gray-50',
    bgTertiary: darkMode ? 'bg-gray-700' : 'bg-gray-100',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textSecondary: darkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: darkMode ? 'text-gray-500' : 'text-gray-400',
    border: darkMode ? 'border-gray-700' : 'border-gray-200',
    hover: darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200',
  };

  // Copy public key
  const copyPublicKey = () => {
    navigator.clipboard?.writeText(pk);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Render avatar
  const renderAvatar = () => {
    if (profile.avatarUrl && profile.avatarUrl.startsWith('http')) {
      return (
        <img 
          src={profile.avatarUrl} 
          alt={name} 
          className="w-full h-full object-cover rounded-3xl" 
        />
      );
    }
    return <span className="text-6xl">{profile.avatar || '👤'}</span>;
  };

  return (
    <div className={`min-h-full ${theme.bg}`}>
      {/* ═══ Cover Gradient ═══ */}
      <div 
        className="h-48 relative"
        style={{ 
          background: `linear-gradient(135deg, ${color}40 0%, ${color}10 100%)` 
        }}
      />

      {/* ═══ Profile Content ═══ */}
      <div className="max-w-2xl mx-auto px-6 -mt-20 relative pb-12">
        {/* Avatar */}
        <div className={`w-36 h-36 rounded-3xl ${theme.bgSecondary} border-4 ${
          darkMode ? 'border-gray-900' : 'border-gray-50'
        } shadow-xl flex items-center justify-center overflow-hidden mb-4`}>
          {renderAvatar()}
        </div>

        {/* Name + Handle + Message Button */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-3xl font-bold ${theme.text}`}>{name}</h1>
              {isVerified && <span className="text-cyan-500 text-xl">✓</span>}
            </div>
            <p className="text-cyan-500 text-lg font-medium">@{handle}</p>
            <p className={`${theme.textSecondary} mt-1 flex items-center gap-2`}>
              <TypeIcon size={16} />
              {profile.tagline || type}
            </p>
          </div>
          
          {/* Message Button */}
          <button
            onClick={() => onMessage?.(profile)}
            className="px-6 py-3 rounded-full text-white font-medium shadow-lg self-start flex items-center gap-2 hover:shadow-xl transition-shadow"
            style={{ backgroundColor: color }}
          >
            <MessageCircle size={18} />
            Message
          </button>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className={`${theme.text} text-lg leading-relaxed mb-6`}>
            {profile.bio}
          </p>
        )}

        {/* Trust Score + Breadcrumbs */}
        <div className={`flex gap-6 md:gap-8 mb-6 pb-6 border-b ${theme.border} flex-wrap`}>
          <div>
            <span className={`${theme.text} font-bold text-lg`}>{trustDisplay}</span>
            <span className={`${theme.textSecondary} ml-2`}>Trust Score</span>
          </div>
          <div>
            <span className={`${theme.text} font-bold text-lg`}>{breadcrumbDisplay}</span>
            <span className={`${theme.textSecondary} ml-2`}>Breadcrumbs</span>
          </div>
        </div>

        {/* Public Key */}
        {pk && (
          <div className={`mb-6 p-4 ${theme.bgTertiary} rounded-xl`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`${theme.textSecondary} text-sm font-medium`}>Public Key</span>
              <button 
                onClick={copyPublicKey}
                className={`flex items-center gap-1 text-sm ${theme.textSecondary} hover:text-cyan-500`}
              >
                {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                {copiedKey ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <code className={`${theme.text} text-xs font-mono break-all`}>{pk}</code>
          </div>
        )}

        {/* Links */}
        {profile.links && profile.links.length > 0 && (
          <div className="flex gap-4 flex-wrap mb-6">
            {profile.links.map((link: string, i: number) => (
              link.startsWith('@') ? (
                <button 
                  key={i} 
                  onClick={() => onNavigate(link)}
                  className="text-cyan-500 hover:underline font-medium"
                >
                  {link}
                </button>
              ) : (
                <a 
                  key={i}
                  href={link.startsWith('http') ? link : `https://${link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-500 hover:underline font-medium flex items-center gap-1"
                >
                  <ExternalLink size={14} />
                  {link.replace(/^https?:\/\//, '')}
                </a>
              )
            ))}
          </div>
        )}

        {/* ═══ Facets (hardcoded to match Tauri) ═══ */}
        <div className={`mt-8 p-6 ${theme.bgSecondary} rounded-2xl border ${theme.border}`}>
          <h3 className={`${theme.textSecondary} text-sm font-semibold mb-4 uppercase tracking-wide`}>
            Facets
          </h3>
          <div className="flex gap-3 flex-wrap">
            {DEFAULT_FACETS.map((f) => (
              <button 
                key={f}
                onClick={() => onNavigate(`@${f}@${handle}`)}
                className={`px-5 py-3 ${theme.bgTertiary} ${theme.hover} rounded-xl ${theme.text} font-medium transition-colors`}
              >
                {f}@{handle}
              </button>
            ))}
          </div>
        </div>

        {/* Modules (if present) */}
        {profile.modules && profile.modules.length > 0 && (
          <div className="mt-6">
            <h3 className={`${theme.textSecondary} text-sm font-semibold mb-3 uppercase tracking-wide`}>
              Modules
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.modules.map((m: any, i: number) => (
                <span
                  key={i}
                  className={`px-3 py-1.5 ${theme.bgTertiary} rounded-full text-xs font-medium ${theme.text}`}
                >
                  {m.schema?.split('/')[0]?.replace('gns.module.', '') || 'module'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Created date */}
        {profile.createdAt && (
          <p className={`mt-6 ${theme.textMuted} text-sm`}>
            Identity created {new Date(profile.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
    </div>
  );
}
