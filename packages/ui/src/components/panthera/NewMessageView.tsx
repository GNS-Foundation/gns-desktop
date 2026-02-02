// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — New Message View
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/NewMessageView.tsx
//
// Compose a new message: resolve @handle → open conversation.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowLeft, Search, Loader2, AtSign } from 'lucide-react';
import { resolveRecipient } from './MessagingService';

interface NewMessageViewProps {
  onSelectRecipient: (publicKey: string, handle?: string) => void;
  onBack: () => void;
  darkMode?: boolean;
}

export default function NewMessageView({ onSelectRecipient, onBack, darkMode = false }: NewMessageViewProps) {
  const [query, setQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    setResolving(true);
    setError(null);

    const result = await resolveRecipient(q);

    if (result.success && result.publicKey) {
      const handle = q.startsWith('@') ? q.replace(/^@/, '') : undefined;
      onSelectRecipient(result.publicKey, handle);
    } else {
      setError(result.error || 'Could not resolve recipient');
    }

    setResolving(false);
  }, [query, onSelectRecipient]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
  };

  const text = darkMode ? 'text-white' : 'text-gray-900';
  const textSec = darkMode ? 'text-gray-400' : 'text-gray-500';
  const bg = darkMode ? 'bg-gray-900' : 'bg-white';
  const border = darkMode ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className={`flex-1 flex flex-col ${bg}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${border} flex items-center gap-3`}>
        <button onClick={onBack} className={`p-2 rounded-lg hover:bg-gray-100 ${textSec}`}>
          <ArrowLeft size={20} />
        </button>
        <h2 className={`font-semibold ${text}`}>New Message</h2>
      </div>

      {/* Recipient input */}
      <div className={`px-4 py-4 border-b ${border}`}>
        <label className={`text-xs font-medium ${textSec} mb-2 block`}>To:</label>
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${border} ${
          darkMode ? 'bg-gray-800' : 'bg-gray-50'
        }`}>
          <AtSign size={16} className={textSec} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setError(null); }}
            onKeyDown={handleKeyDown}
            placeholder="handle or public key"
            className={`flex-1 bg-transparent outline-none text-sm ${text}`}
          />
          <button
            onClick={handleSubmit}
            disabled={!query.trim() || resolving}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              query.trim()
                ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            {resolving ? <Loader2 size={16} className="animate-spin" /> : 'Go'}
          </button>
        </div>
        {error && (
          <p className="text-red-500 text-xs mt-2">{error}</p>
        )}
      </div>

      {/* Help text */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="text-center">
          <Search size={40} className="text-gray-300 mx-auto mb-3" />
          <p className={`text-sm ${textSec}`}>
            Enter a GNS @handle (e.g. <strong>@echo</strong>) or a 64-character public key to start a conversation.
          </p>
        </div>
      </div>
    </div>
  );
}
