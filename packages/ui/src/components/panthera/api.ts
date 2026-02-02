// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — GNS API Client
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/api.ts
//
// Shared API functions for resolving handles, fetching gSites,
// searching, and checking domain organizations.
//
// Domain org lookup is delegated to the legacy-web bridge
// (which handles caching, batching, and Tauri/web adaptation).
// ═══════════════════════════════════════════════════════════════════

const API_BASE = 'https://gns-browser-production.up.railway.app';

// ─── Handle Resolution ───

export interface ProfileResult {
  success: boolean;
  profile?: any;
  error?: string;
}

export async function resolveHandle(handle: string): Promise<ProfileResult> {
  try {
    const res = await fetch(`${API_BASE}/web/profile/${encodeURIComponent(handle)}`);
    const data = await res.json();
    return data.success ? { success: true, profile: data.data } : { success: false, error: data.error };
  } catch (err) {
    return { success: false, error: 'Network error' };
  }
}

// ─── Search ───

export interface SearchResult {
  success: boolean;
  results?: any[];
  error?: string;
}

export async function searchHandles(query: string): Promise<SearchResult> {
  try {
    const res = await fetch(`${API_BASE}/web/search?q=${encodeURIComponent(query)}&limit=20`);
    const data = await res.json();
    return data.success ? { success: true, results: data.data } : { success: false, error: data.error };
  } catch (err) {
    return { success: false, results: [] };
  }
}

// ─── gSite ───

export interface GSiteResult {
  success: boolean;
  gsite?: any;
  error?: string;
}

export async function fetchGSite(identifier: string): Promise<GSiteResult> {
  try {
    const res = await fetch(`${API_BASE}/gsite/${encodeURIComponent(identifier)}`);
    const data = await res.json();
    return data.success ? { success: true, gsite: data.data } : { success: false, error: data.error };
  } catch {
    return { success: false };
  }
}

// ─── Featured Identities ───

export interface FeaturedResult {
  identities: any[];
  entities: any[];
}

export async function getFeatured(): Promise<FeaturedResult> {
  try {
    const res = await fetch(`${API_BASE}/web/featured`);
    const data = await res.json();
    return data.success
      ? { identities: data.data?.identities || [], entities: data.data?.entities || [] }
      : { identities: [], entities: [] };
  } catch {
    return { identities: [], entities: [] };
  }
}
