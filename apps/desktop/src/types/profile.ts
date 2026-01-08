// ===========================================
// GNS BROWSER - PROFILE & FACETS TYPES
// ===========================================
// Based on Flutter implementation: profile_facet.dart, profile_module.dart

// ===========================================
// FACET TYPES
// ===========================================

export type FacetType = 'defaultPersonal' | 'custom' | 'broadcast' | 'system';

// ===========================================
// PROFILE LINK
// ===========================================

export interface ProfileLink {
  type: 'website' | 'github' | 'twitter' | 'linkedin' | 'custom';
  label?: string;
  url: string;
}

// Link type icons
export const LINK_ICONS: Record<string, string> = {
  website: '🌐',
  github: '🐙',
  twitter: '🐦',
  linkedin: '💼',
  custom: '🔗',
};

// ===========================================
// PROFILE FACET
// ===========================================

export interface ProfileFacet {
  id: string;           // "me", "work", "friends", "dix", "home"
  label: string;        // Human-readable label
  emoji: string;        // Visual identifier: 👤, 💼, 🎉
  displayName?: string; // Name shown on this facet
  avatarUrl?: string;   // Avatar (base64 data URL)
  bio?: string;         // Bio for this facet
  links: ProfileLink[];
  type: FacetType;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===========================================
// FACET COLLECTION
// ===========================================

export interface FacetCollection {
  facets: ProfileFacet[];
  defaultFacetId: string;
  primaryFacetId?: string;
}

// ===========================================
// PROFILE DATA (Legacy compatibility)
// ===========================================

export interface ProfileData {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  links: ProfileLink[];
  locationPublic: boolean;
  locationResolution: number;
}

// ===========================================
// FACET TEMPLATES
// ===========================================

export const FACET_TEMPLATES: Omit<ProfileFacet, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'work',
    label: 'Work',
    emoji: '💼',
    type: 'custom',
    isDefault: false,
    links: [],
  },
  {
    id: 'friends',
    label: 'Friends',
    emoji: '🎉',
    type: 'custom',
    isDefault: false,
    links: [],
  },
  {
    id: 'family',
    label: 'Family',
    emoji: '👨‍👩‍👧',
    type: 'custom',
    isDefault: false,
    links: [],
  },
  {
    id: 'travel',
    label: 'Travel',
    emoji: '✈️',
    type: 'custom',
    isDefault: false,
    links: [],
  },
  {
    id: 'creative',
    label: 'Creative',
    emoji: '🎨',
    type: 'custom',
    isDefault: false,
    links: [],
  },
  {
    id: 'gaming',
    label: 'Gaming',
    emoji: '🎮',
    type: 'custom',
    isDefault: false,
    links: [],
  },
];

export const BROADCAST_TEMPLATES: Omit<ProfileFacet, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'dix',
    label: 'DIX',
    emoji: '🎵',
    type: 'broadcast',
    isDefault: false,
    links: [],
  },
  {
    id: 'blog',
    label: 'Blog',
    emoji: '📝',
    type: 'broadcast',
    isDefault: false,
    links: [],
  },
  {
    id: 'news',
    label: 'News',
    emoji: '📰',
    type: 'broadcast',
    isDefault: false,
    links: [],
  },
];

// ===========================================
// EMOJI OPTIONS
// ===========================================

export const FACET_EMOJIS = [
  '👤', '💼', '🎉', '👨‍👩‍👧', '✈️', '🎨', '🎮', '🏠', '💪', '📚',
  '🎵', '📝', '📰', '🎬', '⚽', '🍳', '🌱', '🐾', '🔬', '💡',
];

// ===========================================
// HELPER FUNCTIONS
// ===========================================

export function createDefaultFacet(data?: Partial<ProfileFacet>): ProfileFacet {
  const now = new Date().toISOString();
  return {
    id: 'me',
    label: 'Me',
    emoji: '👤',
    type: 'defaultPersonal',
    isDefault: true,
    links: [],
    createdAt: now,
    updatedAt: now,
    ...data,
  };
}

export function createFacetFromTemplate(
  template: Omit<ProfileFacet, 'createdAt' | 'updatedAt'>
): ProfileFacet {
  const now = new Date().toISOString();
  return {
    ...template,
    createdAt: now,
    updatedAt: now,
  };
}

export function getFacetColor(facet: ProfileFacet): string {
  if (facet.type === 'defaultPersonal') return '#10B981'; // Green
  if (facet.type === 'broadcast') return '#8B5CF6'; // Purple
  if (facet.id === 'home') return '#6366F1'; // Indigo
  
  const colors: Record<string, string> = {
    work: '#3B82F6',    // Blue
    friends: '#F97316', // Orange
    family: '#EC4899',  // Pink
    travel: '#10B981',  // Green
    creative: '#8B5CF6', // Purple
    gaming: '#EF4444',  // Red
  };
  
  return colors[facet.id] || '#6B7280'; // Gray default
}

export function canDeleteFacet(facet: ProfileFacet): boolean {
  return facet.type !== 'defaultPersonal' && facet.type !== 'system';
}

export function getFacetAddress(facetId: string, handle: string): string {
  return `${facetId}@${handle}`;
}

// ===========================================
// LOCATION PRIVACY
// ===========================================

export const LOCATION_RESOLUTION_LABELS: Record<number, string> = {
  4: 'Country',      // ~1,770 km²
  5: 'Region',       // ~253 km²
  6: 'Metro',        // ~36 km²
  7: 'City',         // ~5 km² (DEFAULT)
  8: 'District',     // ~0.7 km²
  9: 'Neighborhood', // ~0.1 km²
  10: 'Block',       // ~0.015 km²
};
