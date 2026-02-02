// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — Facet Context Switcher
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/FacetSwitcher.tsx
//
// Dropdown for switching the active identity context.
// Determines which facet identity is used when messaging,
// paying, or interacting with gSites.
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  UserCircle, Briefcase, ShoppingBag, EyeOff,
  ChevronDown, CheckCircle,
} from 'lucide-react';
import { FacetContext, type FacetContextValue } from './classifier';

interface FacetSwitcherProps {
  activeFacet: FacetContextValue;
  onSwitch: (facet: FacetContextValue) => void;
  handle?: string;
}

const FACETS = [
  { id: FacetContext.PERSONAL,  label: 'Personal',  icon: UserCircle,  desc: 'Friends, interests, social' },
  { id: FacetContext.WORK,      label: 'Work',       icon: Briefcase,   desc: 'Professional, org namespace' },
  { id: FacetContext.COMMERCE,  label: 'Commerce',   icon: ShoppingBag, desc: 'Products, services, reviews' },
  { id: FacetContext.ANONYMOUS, label: 'Anonymous',  icon: EyeOff,      desc: 'Read-only, no identity' },
] as const;

export default function FacetSwitcher({ activeFacet, onSwitch, handle }: FacetSwitcherProps) {
  const [open, setOpen] = useState(false);

  const active = FACETS.find(f => f.id === activeFacet) || FACETS[0];
  const ActiveIcon = active.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-colors"
        title={`Context: ${active.label}`}
      >
        <ActiveIcon size={15} className="text-cyan-600" />
        <span className="text-gray-700 hidden sm:inline">
          {activeFacet !== FacetContext.ANONYMOUS
            ? `${active.label.toLowerCase()}@`
            : 'anon'}
        </span>
        <ChevronDown size={13} className="text-gray-400" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50">
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Identity Context
              </div>
            </div>

            {FACETS.map(f => {
              const Icon = f.icon;
              const isActive = f.id === activeFacet;
              return (
                <button
                  key={f.id}
                  onClick={() => { onSwitch(f.id as FacetContextValue); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isActive ? 'bg-cyan-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-cyan-600' : 'text-gray-400'} />
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${isActive ? 'text-cyan-700' : 'text-gray-700'}`}>
                      {f.id !== FacetContext.ANONYMOUS
                        ? `${f.label.toLowerCase()}@${handle || '...'}`
                        : 'Anonymous'}
                    </div>
                    <div className="text-xs text-gray-400">{f.desc}</div>
                  </div>
                  {isActive && <CheckCircle size={16} className="text-cyan-500" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
