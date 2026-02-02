// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — Search Results
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/SearchResults.tsx
//
// Renders identity search results from /web/search.
// Each result shows handle, display name, bio snippet, trust badge.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { Search, CheckCircle } from 'lucide-react';
import TrustBadge from './TrustBadge';

interface SearchResultsProps {
  query: string;
  results: any[];
  onNavigate: (input: string) => void;
}

export default function SearchResults({ query, results, onNavigate }: SearchResultsProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="text-sm text-gray-500 mb-4">
        {results.length} results for &ldquo;{query}&rdquo;
      </div>

      {results.length === 0 ? (
        <div className="text-center py-16">
          <Search size={40} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-gray-600 font-medium mb-1">No identities found</h3>
          <p className="text-gray-400 text-sm">
            Try a different @handle or search term
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((r, i) => {
            const identity = r.identity || r;
            return (
              <button
                key={i}
                onClick={() => onNavigate(`@${identity.handle}`)}
                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {(identity.handle || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">
                      @{identity.handle}
                    </span>
                    {identity.isVerified && (
                      <CheckCircle size={14} className="text-cyan-500" />
                    )}
                  </div>
                  {identity.displayName && (
                    <div className="text-sm text-gray-500">
                      {identity.displayName}
                    </div>
                  )}
                  {identity.bio && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {identity.bio}
                    </div>
                  )}
                </div>
                <TrustBadge score={identity.trustScore || 0} compact />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
