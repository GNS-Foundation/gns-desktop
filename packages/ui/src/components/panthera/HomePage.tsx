// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — Home Page (New Tab)
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/HomePage.tsx
//
// New tab page: PANTHERA logo, quick links, featured identities,
// usage hint. Similar to Chrome's new tab but for the Identity Web.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { User, MessageCircle, CreditCard } from 'lucide-react';
import { getFeatured } from './api';
import PantherLogo from './PantherLogo';

interface HomePageProps {
  onNavigate: (input: string) => void;
  darkMode?: boolean;
}

export default function HomePage({ onNavigate, darkMode }: HomePageProps) {
  const [featured, setFeatured] = useState<{ identities: any[]; entities: any[] }>({
    identities: [],
    entities: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeatured().then(data => {
      setFeatured(data);
      setLoading(false);
    });
  }, []);

  const quickLinks = [
    { label: 'My Profile', icon: User,          action: '@me' },
    { label: 'Messages',   icon: MessageCircle,  action: 'messages' },
    { label: 'Wallet',     icon: CreditCard,     action: 'wallet' },
  ];

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-12">
      <PantherLogo size={100} className="mb-4 opacity-90" />
      <h1 className="text-4xl font-bold text-gray-900 mb-1 tracking-tight">
        PANTHERA
      </h1>
      <p className="text-gray-500 text-base mb-10">
        Browse the Identity Web
      </p>

      {/* Quick shortcuts */}
      <div className="flex items-center gap-4 mb-12">
        {quickLinks.map(q => {
          const Icon = q.icon;
          return (
            <button
              key={q.label}
              onClick={() => onNavigate(q.action)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-gray-100 transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-cyan-100 flex items-center justify-center transition-colors">
                <Icon
                  size={22}
                  className="text-gray-500 group-hover:text-cyan-600 transition-colors"
                />
              </div>
              <span className="text-xs text-gray-500 group-hover:text-gray-700">
                {q.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Featured identities */}
      {featured.identities.length > 0 && (
        <div className="w-full max-w-2xl">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Featured Identities
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {featured.identities.slice(0, 8).map((identity, i) => (
              <button
                key={i}
                onClick={() =>
                  onNavigate(identity.handle?.replace('@', '') || '')
                }
                className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(identity.handle || '?').replace('@', '')[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {identity.handle || '?'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {identity.trustScore || 0}% trust
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Usage hint */}
      <div className="mt-12 text-center">
        <p className="text-xs text-gray-400">
          Type{' '}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px] text-gray-600">
            @handle
          </code>{' '}
          for identities, URLs for websites, or anything to search
        </p>
      </div>
    </div>
  );
}
