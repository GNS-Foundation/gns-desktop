// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — Component Index
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/index.ts
//
// Barrel export for the PANTHERA browser shell component family.
// Both apps/web and apps/desktop import from here via @gns/ui.
// ═══════════════════════════════════════════════════════════════════

// Core logic
export { classifyInput, extractDomain, InputType, ViewMode, FacetContext } from './classifier';
export type { ClassifiedInput, InputTypeValue, ViewModeValue, FacetContextValue } from './classifier';

// API functions
export { resolveHandle, searchHandles, fetchGSite, getFeatured } from './api';

// Auth
export { default as AuthProvider, useAuth } from './AuthProvider';
export type { GnsSession, AuthContextValue } from './AuthProvider';
export { default as QRLoginModal } from './QRLoginModal';

// Components
export { default as PantherLogo } from './PantherLogo';
export { default as TrustBadge, getTrustColor, getTrustLabel } from './TrustBadge';
export { default as FacetSwitcher } from './FacetSwitcher';
export { default as AddressBar } from './AddressBar';
export { default as GSiteRenderer } from './GSiteRenderer';
export { default as LegacyWebView } from './LegacyWebView';
export { default as HomePage } from './HomePage';
export { default as SearchResults } from './SearchResults';
export { default as PantheraShell } from './PantheraShell';
