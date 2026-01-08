/**
 * New Conversation - Search for @handle and start chatting
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, User } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getPublicKey } from '../lib/tauri';

interface HandleInfo {
  public_key: string;
  encryption_key: string;
  handle?: string;
  avatar_url?: string;
  display_name?: string;
  is_verified: boolean;
}

export function NewConversation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('recipient') || '');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<HandleInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-search if recipient provided
    if (searchParams.get('recipient')) {
      handleSearch();
    }
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setError(null);
    setResult(null);

    try {
      const cleanHandle = query.trim().replace(/^@/, '');
      const info = await invoke<HandleInfo | null>('resolve_handle', {
        handle: cleanHandle
      });

      if (info) {
        setResult(info);
      } else {
        setError(`@${cleanHandle} not found`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const startConversation = async () => {
    if (!result) return;

    // Get local identity to form canonical thread ID
    const myPk = await getPublicKey();
    if (!myPk) {
      setError("Could not get local public key");
      return;
    }

    // Create a thread ID based on sorted public keys (deterministic)
    // Must match Rust backend format: direct_{sorted_keys}[0..32]
    // Ensure lowercase to match Rust hex output and sort order
    const keys = [myPk.toLowerCase(), result.public_key.toLowerCase()].sort();
    const joined = keys.join('_');
    const threadId = `direct_${joined.substring(0, 32)}`;

    navigate(`/messages/${threadId}`, {
      state: {
        recipientPublicKey: result.public_key,
        recipientHandle: result.handle,
        recipientEncryptionKey: result.encryption_key,
      }
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 bg-surface/95 backdrop-blur-lg border-b border-border p-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/messages')}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">New Conversation</h1>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search @handle (e.g. @echo)"
            className="input w-full pl-10 pr-20"
            autoFocus
          />
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-4">
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {result && (
          <button
            onClick={startConversation}
            className="w-full p-4 flex items-center gap-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              {result.handle ? (
                <span className="text-lg font-bold">
                  {result.handle[0].toUpperCase()}
                </span>
              ) : (
                <User className="w-6 h-6" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">
                {result.handle ? `@${result.handle}` : 'Anonymous'}
              </h3>
              <p className="text-slate-400 text-sm truncate">
                {result.public_key.slice(0, 16)}...{result.public_key.slice(-8)}
              </p>
            </div>

            <div className="text-blue-400 text-sm">Start chat →</div>
          </button>
        )}

        {!result && !error && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="font-semibold mb-2">Search for someone</h3>
            <p className="text-slate-400 text-sm">
              Enter a @handle to start a conversation
            </p>
            <p className="text-slate-500 text-xs mt-2">
              Try @echo to test messaging
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
