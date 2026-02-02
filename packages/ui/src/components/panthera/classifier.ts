// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — Input Classifier & Route Types
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/classifier.ts
//
// Core routing logic: classifies address bar input into navigation type.
// This is the brain of PANTHERA's triple-function address bar.
// ═══════════════════════════════════════════════════════════════════

export const InputType = {
  HANDLE: 'handle',
  FACET_HANDLE: 'facet',
  LEGACY_URL: 'url',
  SEARCH: 'search',
  EMPTY: 'empty',
} as const;

export type InputTypeValue = typeof InputType[keyof typeof InputType];

export const ViewMode = {
  HOME: 'home',
  GSITE: 'gsite',
  LEGACY_WEB: 'legacy_web',
  SEARCH: 'search',
  MESSAGES: 'messages',
  LOADING: 'loading',
  ERROR: 'error',
} as const;

export type ViewModeValue = typeof ViewMode[keyof typeof ViewMode];

export const FacetContext = {
  PERSONAL: 'personal',
  WORK: 'work',
  COMMERCE: 'commerce',
  ANONYMOUS: 'anonymous',
} as const;

export type FacetContextValue = typeof FacetContext[keyof typeof FacetContext];

export interface ClassifiedInput {
  type: InputTypeValue;
  handle?: string;
  facet?: string;
  identifier?: string;
  url?: string;
  domain?: string;
  query?: string;
}

/**
 * Extract clean domain from URL or domain string
 */
export function extractDomain(input: string): string {
  try {
    let d = input.replace(/^https?:\/\//, '').replace(/^www\./, '');
    return d.split('/')[0].split(':')[0].toLowerCase();
  } catch {
    return input;
  }
}

/**
 * Classify address bar input into navigation type.
 * This is the core routing logic of PANTHERA.
 *
 *   @handle          → HANDLE
 *   facet@handle     → FACET_HANDLE
 *   https://x.com    → LEGACY_URL
 *   google.com       → LEGACY_URL (bare domain)
 *   pizza near me    → SEARCH
 */
export function classifyInput(raw: string): ClassifiedInput {
  const input = raw.trim();
  if (!input) return { type: InputType.EMPTY };

  // 1. Legacy URL — starts with http:// or https://
  if (/^https?:\/\//i.test(input)) {
    let url: string | null = input;
    try { new URL(url); } catch { url = null; }
    return { type: InputType.LEGACY_URL, url: url || input, domain: extractDomain(input) };
  }

  // 2. Bare domain (contains dot, no spaces) → treat as URL
  if (/^[^\s]+\.[a-z]{2,}$/i.test(input) && !input.includes(' ')) {
    const url = `https://${input}`;
    return { type: InputType.LEGACY_URL, url, domain: extractDomain(input) };
  }

  // 3. Facet@handle (e.g., work@camiloayerbe, cafe@luigi)
  if (input.includes('@') && !input.startsWith('@') && !input.includes(' ')) {
    const parts = input.toLowerCase().split('@');
    if (parts.length === 2 && parts[1].length > 0) {
      const [facet, handle] = parts;
      return {
        type: InputType.FACET_HANDLE,
        handle,
        facet,
        identifier: `${facet}@${handle}`,
      };
    }
    // Multi-facet chain: a@b@c → facetChain = a@b, handle = c
    if (parts.length > 2) {
      const handle = parts[parts.length - 1];
      const facetChain = parts.slice(0, -1).join('@');
      return {
        type: InputType.FACET_HANDLE,
        handle,
        facet: facetChain,
        identifier: input.toLowerCase(),
      };
    }
  }

  // 4. @handle or single word (no spaces, no dots → handle)
  if (!input.includes(' ') && !input.includes('.')) {
    const handle = input.replace(/^@/, '').toLowerCase();
    return { type: InputType.HANDLE, handle, identifier: `@${handle}` };
  }

  // 5. Anything else → search query
  return { type: InputType.SEARCH, query: input };
}
