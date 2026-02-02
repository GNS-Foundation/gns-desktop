// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — Legacy Web Bridge
// ═══════════════════════════════════════════════════════════════════
// Location: gns-browser-tauri/ui/src/lib/legacy-web.ts
//
// Adaptive bridge: uses Tauri native webview on desktop,
// falls back to iframe on web. Handles GNS org domain lookup
// for the trust overlay in both modes.
// ═══════════════════════════════════════════════════════════════════

const API_BASE = 'https://gns-browser-production.up.railway.app';

// ═══════════════════════════════════════════════════════════════════
// PLATFORM DETECTION
// ═══════════════════════════════════════════════════════════════════

/** Check if running inside Tauri desktop app */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/** Check if Tauri IPC is available */
async function getTauriInvoke(): Promise<((cmd: string, args?: any) => Promise<any>) | null> {
  if (!isTauri()) return null;
  try {
    // Tauri v2 API
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    try {
      // Tauri v1 fallback
      const { invoke } = await import('@tauri-apps/api/tauri');
      return invoke;
    } catch {
      return null;
    }
  }
}


// ═══════════════════════════════════════════════════════════════════
// DOMAIN → GNS ORG LOOKUP
// ═══════════════════════════════════════════════════════════════════

export interface OrgInfo {
  namespace: string;
  displayName: string;
  domain: string;
  tier: string;
  verified: boolean;
  status: string;
  trustScore?: number;
  matchedVia?: string;
  createdAt?: string;
}

// In-memory cache for domain lookups (avoid hammering the API)
const domainCache = new Map<string, { result: OrgInfo | null; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/** Look up GNS organization by domain */
export async function lookupDomainOrg(domain: string): Promise<OrgInfo | null> {
  if (!domain) return null;

  // Clean domain
  const clean = domain.toLowerCase().replace(/^www\./, '');

  // Check cache
  const cached = domainCache.get(clean);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  try {
    const res = await fetch(`${API_BASE}/org/by-domain/${encodeURIComponent(clean)}`);
    const data = await res.json();

    if (data.success && data.data) {
      const result: OrgInfo = data.data;
      domainCache.set(clean, { result, timestamp: Date.now() });
      return result;
    }

    // Cache negative result too
    domainCache.set(clean, { result: null, timestamp: Date.now() });
    return null;
  } catch (err) {
    console.warn(`GNS org lookup failed for ${clean}:`, err);
    return null;
  }
}

/** Batch lookup for multiple domains (used when page has many external links) */
export async function lookupDomainOrgBatch(domains: string[]): Promise<Record<string, OrgInfo | null>> {
  if (!domains.length) return {};

  // Filter out already cached
  const uncached = domains.filter(d => {
    const cached = domainCache.get(d.toLowerCase().replace(/^www\./, ''));
    return !cached || Date.now() - cached.timestamp >= CACHE_TTL;
  });

  if (uncached.length > 0) {
    try {
      const res = await fetch(`${API_BASE}/org/by-domain-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: uncached }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        for (const [domain, info] of Object.entries(data.data)) {
          domainCache.set(domain, {
            result: info as OrgInfo | null,
            timestamp: Date.now(),
          });
        }
      }
    } catch (err) {
      console.warn('Batch domain lookup failed:', err);
    }
  }

  // Build result from cache
  const result: Record<string, OrgInfo | null> = {};
  for (const d of domains) {
    const clean = d.toLowerCase().replace(/^www\./, '');
    result[d] = domainCache.get(clean)?.result || null;
  }
  return result;
}


// ═══════════════════════════════════════════════════════════════════
// LEGACY WEB NAVIGATION
// ═══════════════════════════════════════════════════════════════════

export interface LegacyWebState {
  url: string;
  domain: string;
  title?: string;
  is_loading: boolean;
}

/**
 * Open a legacy URL — uses native webview in Tauri, returns info for iframe fallback on web
 */
export async function openLegacyUrl(url: string): Promise<LegacyWebState> {
  const invoke = await getTauriInvoke();

  if (invoke) {
    // Tauri desktop: use native webview (bypasses X-Frame-Options!)
    try {
      const state = await invoke('open_legacy_url', { url });
      return state as LegacyWebState;
    } catch (err) {
      console.error('Tauri webview failed:', err);
      // Fall through to web mode
    }
  }

  // Web mode: return state for iframe rendering
  const domain = extractDomain(url);
  return {
    url,
    domain,
    is_loading: true,
  };
}

/**
 * Navigate existing webview to new URL
 */
export async function navigateLegacy(url: string): Promise<LegacyWebState> {
  const invoke = await getTauriInvoke();

  if (invoke) {
    try {
      return await invoke('navigate_legacy', { url }) as LegacyWebState;
    } catch (err) {
      console.error('Tauri navigate failed:', err);
    }
  }

  const domain = extractDomain(url);
  return { url, domain, is_loading: true };
}

/**
 * Close the legacy webview
 */
export async function closeLegacyWebview(): Promise<void> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    try { await invoke('close_legacy_webview'); } catch {}
  }
}

/**
 * Get current webview state
 */
export async function getLegacyState(): Promise<LegacyWebState | null> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      return await invoke('get_legacy_state') as LegacyWebState | null;
    } catch { return null; }
  }
  return null;
}


// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function extractDomain(url: string): string {
  try {
    let d = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
    return d.split('/')[0].split(':')[0].toLowerCase();
  } catch {
    return url;
  }
}

/** Known sites that block iframes (only relevant for web mode) */
const IFRAME_BLOCKED_DOMAINS = new Set([
  'google.com', 'youtube.com', 'twitter.com', 'x.com',
  'facebook.com', 'instagram.com', 'github.com', 'linkedin.com',
  'reddit.com', 'amazon.com', 'apple.com', 'microsoft.com',
  'netflix.com', 'spotify.com', 'twitch.tv', 'discord.com',
]);

/** Check if a domain is known to block iframes (web mode only) */
export function isIframeBlocked(domain: string): boolean {
  if (isTauri()) return false; // Native webview bypasses this
  const clean = domain.toLowerCase().replace(/^www\./, '');
  return IFRAME_BLOCKED_DOMAINS.has(clean) ||
    Array.from(IFRAME_BLOCKED_DOMAINS).some(d => clean.endsWith(`.${d}`));
}


// ═══════════════════════════════════════════════════════════════════
// TAURI EVENT LISTENER (for navigation events from native webview)
// ═══════════════════════════════════════════════════════════════════

/**
 * Listen for navigation events from the native webview
 * Call this in your React component's useEffect
 *
 * Usage:
 *   useEffect(() => {
 *     const unlisten = listenLegacyNavigation((state) => {
 *       setWebState(state);
 *       lookupDomainOrg(state.domain).then(setOrgInfo);
 *     });
 *     return () => { unlisten.then(fn => fn?.()); };
 *   }, []);
 */
export async function listenLegacyNavigation(
  callback: (state: LegacyWebState) => void
): Promise<(() => void) | undefined> {
  if (!isTauri()) return undefined;

  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<LegacyWebState>('legacy-web-navigated', (event) => {
      callback(event.payload);
    });
    return unlisten;
  } catch {
    return undefined;
  }
}
