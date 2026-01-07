// ===========================================
// GNS BROWSER - GSITE TYPES (PROOF PROFILE)
// ===========================================
// Updated to support GSite Proof Profile spec

// ===========================================
// CORE PROFILE
// ===========================================

export interface GSiteProfile {
  // === IDENTITY ===
  handle: string;
  publicKey?: string;
  isVerified?: boolean;

  // === FROM DEFAULT FACET (Declared) ===
  declared: {
    displayName: string;
    avatar?: MediaRef;
    cover?: MediaRef;
    bio?: string;
    tagline?: string;
    location?: Location;
    website?: string;
    links: Link[];
    skills: string[];
    // Legacy support
    emails?: string[];
    phones?: string[];
  };

  // === FROM GNS RECORD (Earned/Proven) ===
  proven: {
    trustScore: number;              // 0-100 calculated
    trustBreakdown?: TrustBreakdown;
    trajectory?: TrajectoryStats;
    breadcrumbCount: number;
    accountAgeDays?: number;
    createdAt?: string;              // ISO date
  };

  // === ACTIVITY (Aggregated) ===
  activity?: {
    recentActions: ActivityItem[];
    dixPostCount: number;
    transactionCount: number;
    lastActive?: string;
  };

  // === CREDENTIALS ===
  credentials?: Credential[];
  endorsements?: Endorsement[];

  // Legacy ID for compatibility
  '@id'?: string;
  '@type'?: string;
}

// ===========================================
// TRUST & TRAJECTORY
// ===========================================

export interface TrustBreakdown {
  overall: number;
  components: {
    consistency?: TrustComponent;
    longevity?: TrustComponent;
    activity?: TrustComponent;
    diversity?: TrustComponent;
    verification?: TrustComponent;
  };
}

export interface TrustComponent {
  score: number;
  description: string;
  [key: string]: any; // Allow specific extra fields
}

export interface TrajectoryStats {
  totalBreadcrumbs: number;
  totalDistance?: number;
  countries: Array<{ code: string; name: string; count: number }>;
  cities: Array<{ name: string; country: string; count: number }>;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
}

// ===========================================
// ACTIVITY & CREDENTIALS
// ===========================================

export interface ActivityItem {
  id: string;
  type: 'breadcrumb' | 'dix_post' | 'payment_sent' | 'payment_received' | 'handle_claimed' | 'attestation' | 'endorsement' | 'milestone';
  timestamp: string;
  title: string;
  subtitle?: string;
  icon?: string;
  data?: any;
}

export interface Credential {
  id: string;
  issuer: string;
  issuerName: string;
  claim: {
    type: string;
    title: string;
    description?: string;
    startDate?: string;
    endDate?: string;
  };
  verified: boolean;
  issuedAt: string;
}

export interface Endorsement {
  id: string;
  endorser: string;
  endorserName: string;
  skill: string;
  createdAt: string;
}

// ===========================================
// SHARED / LEGACY TYPES
// ===========================================

export interface MediaRef {
  url: string;
  alt?: string;
}

export interface Location {
  address?: string;
  city?: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
}

export interface Link {
  type: string;
  url: string;
  label?: string;
  handle?: string;
}

// Re-export legacy GSite type as a union or compatible shape if strictly needed by other files,
// but for the Viewer we will migrate to GSiteProfile.
// We'll keep a minimal compatibility interface for now to avoid breaking other files immediately.
export interface GSite {
  '@id': string;
  '@type': string;
  name: string;
  avatar?: MediaRef;
  cover?: MediaRef;
  trust?: { score: number };
  actions?: any;
  // ... other legacy fields loosely typed for now
  [key: string]: any;
}

// Helper to determine link icon
export function getLinkIcon(type: string): string {
  switch (type?.toLowerCase()) {
    case 'twitter': return '𝕏';
    case 'instagram': return '📸';
    case 'github': return '🐙';
    case 'linkedin': return '💼';
    case 'youtube': return '📺';
    case 'tiktok': return '🎵';
    case 'website': return '🌐';
    default: return '🔗';
  }
}

export function formatLocation(loc?: Location): string {
  if (!loc) return '';
  const parts = [loc.city, loc.country].filter(Boolean);
  return parts.join(', ');
}
// ===========================================
// LEGACY TYPES (RESTORED)
// ===========================================

export interface TrustInfo {
  score: number;
  breadcrumbs: number;
  since?: string;
  verifications: any[];
}

export interface Actions {
  message: boolean;
  payment: boolean;
  call: boolean;
  share: boolean;
  follow: boolean;
  directions: boolean;
}

export interface Facet {
  name: string;
  id: string;
  public: boolean;
}

export interface MenuItem {
  name: string;
  price: { amount: number; currency: string; display?: string };
  description?: string;
  image?: MediaRef;
  available: boolean;
}

export interface GSiteBase {
  '@context': string;
  '@type': string;
  '@id': string;
  name: string;
  tagline?: string;
  bio?: string;
  avatar?: MediaRef;
  cover?: MediaRef;
  trust?: TrustInfo;
  location?: Location;
  links: Link[];
  actions: Actions;
  version: number;
}

export interface PersonGSite extends GSiteBase {
  '@type': 'Person';
  facets: Facet[];
  skills: string[];
  interests: string[];
  status?: {
    text: string;
    emoji?: string;
    available?: boolean;
  };
}

export interface BusinessGSite extends GSiteBase {
  '@type': 'Business';
  category: string;
  subcategories: string[];
  hours?: any;
  phone?: string;
  email?: string;
  menu: MenuItem[];
  features: string[];
  priceLevel?: number;
  rating?: number;
  reviewCount?: number;
}


// ===========================================
// LEGACY HELPERS
// ===========================================

export const DEFAULT_ACTIONS: Actions = {
  message: true,
  payment: false,
  call: false,
  share: true,
  follow: false,
  directions: false,
};

export function getHandle(gsite: { '@id': string }): string {
  return gsite['@id']?.startsWith('@') ? gsite['@id'] : `@${gsite['@id'] || ''}`;
}

export function isPersonGSite(gsite: any): gsite is PersonGSite {
  return gsite['@type'] === 'Person';
}

export function isBusinessGSite(gsite: any): gsite is BusinessGSite {
  return gsite['@type'] === 'Business';
}

export function getTrustColor(score: number): string {
  if (score >= 76) return '#3B82F6';
  if (score >= 51) return '#10B981';
  if (score >= 26) return '#FBBF24';
  return '#6B7280';
}

export function getTrustLabel(score: number): string {
  if (score >= 76) return 'Highly Trusted';
  if (score >= 51) return 'Trusted';
  if (score >= 26) return 'Building Trust';
  return 'New';
}

export function getLinkUrl(link: Link): string {
  return link.url || '';
}

// Business Helpers
export function formatDayHours(hours: any, day?: string): string {
  if (!hours) return 'Closed';
  if (!day) return 'Open'; // fallback if no day provided
  if (!hours[day]) return 'Closed';
  return hours[day]; // Mock implementation
}

export function isOpenNow(_hours: any): boolean {
  return true; // Mock implementation
}

export function formatPrice(amount: number | { amount: number, currency: string }, currency?: string): string {
  if (typeof amount === 'object') {
    return `${amount.currency} ${amount.amount.toFixed(2)}`;
  }
  return `${currency || '$'} ${amount.toFixed(2)}`;
}

export function formatPriceLevel(level?: number): string {
  if (!level) return '';
  return '$'.repeat(level);
}

// Re-export type GSiteType
export type GSiteType =
  | 'Person'
  | 'Business'
  | 'Store'
  | 'Service'
  | 'Organization'
  | 'Event';
