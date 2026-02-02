// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — Triple-Function Address Bar
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/AddressBar.tsx
//
// The brain of PANTHERA navigation. Accepts:
//   @handle / facet@handle  → Identity Web navigation
//   http://... / domain.com → Legacy Web Fallback
//   plain text              → TrIP Search + handle search
//
// Features:
//   - Live classification hints (@ icon, globe, search icon)
//   - HTTPS/HTTP security indicator for legacy URLs
//   - Debounced live suggestions from /web/search
//   - Keyboard: Enter to navigate, Escape to clear
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, Globe, Lock, Unlock, Loader2, X,
} from 'lucide-react';
import { classifyInput, InputType, ViewMode, type ViewModeValue } from './classifier';
import { searchHandles } from './api';
import TrustBadge from './TrustBadge';

interface AddressBarProps {
  value: string;
  onChange: (value: string) => void;
  onNavigate: (input: string) => void;
  viewMode: ViewModeValue;
  isLoading: boolean;
}

export default function AddressBar({
  value,
  onChange,
  onNavigate,
  viewMode,
  isLoading,
}: AddressBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ─── Classify input live for visual hints ───
  const liveClass = useMemo(() => classifyInput(value), [value]);

  // ─── Icon based on classification ───
  const InputIcon = useMemo(() => {
    switch (liveClass.type) {
      case InputType.HANDLE:
      case InputType.FACET_HANDLE:
        return () => <span className="text-cyan-500 font-bold text-sm">@</span>;
      case InputType.LEGACY_URL:
        return () => <Globe size={15} className="text-gray-400" />;
      case InputType.SEARCH:
      default:
        return () => <Search size={15} className="text-gray-400" />;
    }
  }, [liveClass.type]);

  // ─── Security indicator for legacy URLs ───
  const SecurityIndicator = useMemo(() => {
    if (viewMode !== ViewMode.LEGACY_WEB || liveClass.type !== InputType.LEGACY_URL) return null;
    const isHttps = value.startsWith('https://');
    return (
      <div className={`flex items-center gap-1 mr-1 ${isHttps ? 'text-green-600' : 'text-yellow-600'}`}>
        {isHttps ? <Lock size={13} /> : <Unlock size={13} />}
      </div>
    );
  }, [viewMode, liveClass.type, value]);

  // ─── Live search suggestions ───
  useEffect(() => {
    if (!focused || !value || value.length < 2) {
      setSuggestions([]);
      return;
    }
    if (liveClass.type === InputType.LEGACY_URL) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const q = value.replace(/^@/, '');
      if (q.length < 2) return;
      const result = await searchHandles(q);
      if (result.success && result.results && result.results.length > 0) {
        setSuggestions(result.results.slice(0, 5));
      } else {
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [value, focused, liveClass.type]);

  // ─── Handlers ───
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSuggestions([]);
    inputRef.current?.blur();
    onNavigate(value);
  }, [value, onNavigate]);

  const handleSuggestionClick = useCallback((handle: string) => {
    setSuggestions([]);
    onChange(`@${handle}`);
    onNavigate(`@${handle}`);
  }, [onChange, onNavigate]);

  const handleClear = useCallback(() => {
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  // ─── Hint text ───
  const hintText = useMemo(() => {
    switch (liveClass.type) {
      case InputType.HANDLE:      return `Navigate to @${liveClass.handle}`;
      case InputType.FACET_HANDLE: return `Navigate to ${liveClass.facet}@${liveClass.handle}`;
      case InputType.LEGACY_URL:   return `Open ${liveClass.domain}`;
      case InputType.SEARCH:       return `Search: ${value}`;
      default:                     return null;
    }
  }, [liveClass, value]);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="relative flex-1">
      <form onSubmit={handleSubmit}>
        <div
          className={`flex items-center bg-gray-100 rounded-full px-4 py-2 border transition-all ${
            focused
              ? 'border-cyan-500 bg-white shadow-sm ring-2 ring-cyan-100'
              : 'border-transparent'
          }`}
        >
          {SecurityIndicator}
          <InputIcon />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            placeholder="Search @handles, type URLs, or ask anything..."
            className="bg-transparent flex-1 text-sm text-gray-800 outline-none ml-2 placeholder-gray-400"
            spellCheck={false}
            autoComplete="off"
          />
          {isLoading && <Loader2 size={15} className="text-cyan-500 animate-spin" />}
          {!isLoading && value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-200 rounded-full"
            >
              <X size={14} className="text-gray-400" />
            </button>
          )}
        </div>
      </form>

      {/* Live hint below address bar */}
      {focused && hintText && value.length > 1 && (
        <div className="absolute top-full left-0 right-0 mt-0.5 px-4">
          <div className="text-xs text-gray-400 py-1">{hintText} — press Enter</div>
        </div>
      )}

      {/* Suggestions dropdown */}
      {focused && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 max-h-64 overflow-auto">
          {suggestions.map((s, i) => {
            const handle = s.identity?.handle || s.handle;
            return (
              <button
                key={i}
                onMouseDown={() => handleSuggestionClick(handle)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(handle || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    @{handle}
                  </div>
                  {s.identity?.displayName && (
                    <div className="text-xs text-gray-400 truncate">
                      {s.identity.displayName}
                    </div>
                  )}
                </div>
                <TrustBadge score={s.identity?.trustScore || 0} compact />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
