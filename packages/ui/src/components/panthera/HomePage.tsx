// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — Home Page (New Tab)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, X } from 'lucide-react';
import { getFeatured } from './api';
import PantherLogo from './PantherLogo';

const HIVE_STATUS_URL = 'https://gns-browser-production.up.railway.app/hive/status';

interface HiveStatus {
  active_nodes: number;
  total_tflops: number;
  total_tokens_distributed: number;
  pipeline_cells: number;
}

interface HomePageProps {
  onNavigate: (input: string) => void;
  darkMode?: boolean;
}

const GRID_ITEMS = [
  { label: '@hai',       emoji: '🤖', action: 'hai',       desc: 'AI assistant',      accent: '#0099cc' },
  { label: '@echo',      emoji: '🔊', action: 'echo',      desc: 'Echo bot',           accent: '#6b7280' },
  { label: 'My Profile', emoji: '👤', action: '@me',       desc: 'Your identity',      accent: '#7c3aed' },
  { label: 'Messages',   emoji: '💬', action: 'messages',  desc: 'Inbox',              accent: '#0099cc' },
  { label: 'Wallet',     emoji: '💰', action: 'wallet',    desc: 'GNS & payments',     accent: '#00c853' },
  { label: 'Hive',       emoji: '⬡',  action: 'hive',      desc: 'Inference network',  accent: '#00c853' },
  { label: 'Console',    emoji: '📊', action: '__console', desc: 'Live dashboard',     accent: '#ffab00' },
];

export default function HomePage({ onNavigate, darkMode }: HomePageProps) {
  const [featured, setFeatured] = useState<{ identities: any[]; entities: any[] }>({ identities: [], entities: [] });
  const [hive, setHive] = useState<HiveStatus | null>(null);
  const [gridOpen, setGridOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getFeatured().then(data => setFeatured(data));
    const fetchHive = () =>
      fetch(HIVE_STATUS_URL).then(r => r.json()).then(d => d.success && setHive(d.data)).catch(() => {});
    fetchHive();
    const timer = setInterval(fetchHive, 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) setGridOpen(false);
    };
    if (gridOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [gridOpen]);

  const handleGridItem = (item: typeof GRID_ITEMS[0]) => {
    setGridOpen(false);
    if (item.action === '__console') window.open('https://hive.geiant.com/console', '_blank');
    else onNavigate(item.action);
  };

  const GridSection = ({ title, items }: { title: string; items: typeof GRID_ITEMS }) => (
    <>
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">{title}</p>
      <div className="grid grid-cols-3 gap-1 mb-3">
        {items.map(item => (
          <button key={item.action} onClick={() => handleGridItem(item)}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
              style={{ backgroundColor: item.accent + '18' }}>
              {item.emoji}
            </div>
            <span className="text-[11px] text-gray-600 font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-12 relative">

      {/* Grid button — top right like Google */}
      <div className="absolute top-4 right-4 flex flex-col items-end" ref={gridRef}>
        <button onClick={() => setGridOpen(v => !v)}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          title="Apps">
          <LayoutGrid size={20} className="text-gray-500" />
        </button>

        {gridOpen && (
          <div className="fixed top-16 right-4 w-64 max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your favourites</span>
              <button onClick={() => setGridOpen(false)} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-100">
                <X size={14} className="text-gray-400" />
              </button>
            </div>

            <GridSection title="AI Agents" items={GRID_ITEMS.filter(i => ['hai','echo'].includes(i.action))} />
            <GridSection title="Identity" items={GRID_ITEMS.filter(i => ['@me','messages','wallet'].includes(i.action))} />
            <GridSection title="Hive" items={GRID_ITEMS.filter(i => ['hive','__console'].includes(i.action))} />

            {featured.identities.length > 0 && (
              <>
                <div className="border-t border-gray-100 my-3" />
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Your Network</p>
                <div className="flex flex-col gap-1">
                  {featured.identities.slice(0, 4).map((identity, i) => (
                    <button key={i}
                      onClick={() => { onNavigate(identity.handle?.replace('@','') || ''); setGridOpen(false); }}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-left">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {(identity.handle || '?').replace('@','')[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 text-sm font-medium text-gray-700 truncate">{identity.handle}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{identity.trustScore || 0}%</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Logo + title */}
      <PantherLogo size={100} className="mb-4 opacity-90" />
      <h1 className="text-4xl font-bold text-gray-900 mb-1 tracking-tight">PANTHERA</h1>
      <p className="text-gray-500 text-base mb-6">Browse the Identity Web</p>

      {/* Hive status pill */}
      {hive && (
        <button onClick={() => window.open('https://hive.geiant.com/console', '_blank')}
          className="flex items-center gap-3 mb-10 px-5 py-2.5 rounded-full border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 transition-colors">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          <span className="text-xs font-mono text-cyan-700">
            {hive.active_nodes} nodes · {hive.total_tflops.toFixed(1)} TFLOPS · {hive.total_tokens_distributed.toFixed(4)} GNS
            {hive.pipeline_cells > 0 && ` · ${hive.pipeline_cells} pipeline`}
          </span>
        </button>
      )}

      {/* Usage hint */}
      <p className="text-xs text-gray-400">
        Type{' '}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px] text-gray-600">@handle</code>
        {' '}for identities, URLs for websites, or anything to search
      </p>
    </div>
  );
}
