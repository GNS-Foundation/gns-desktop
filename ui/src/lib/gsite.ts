// ===========================================
// GNS BROWSER - GSITE SERVICE (PHASE 1 - PATCHED)
// ===========================================
// Fetches profile from backend + facet from localStorage
// Transforms into GSiteProfile format

import { GSiteProfile, TrustBreakdown, GSite, PersonGSite, DEFAULT_ACTIONS } from '../types/gsite';

const API_BASE = 'https://gns-browser-production.up.railway.app';

// ===========================================
// RESULT TYPE
// ===========================================

export interface GSiteResult {
  success: boolean;
  data?: GSiteProfile;
  error?: string;
  isOwnProfile: boolean;
}

// ===========================================
// GET CURRENT USER HANDLE (FIXED!)
// ===========================================

function getCurrentUserHandle(): string | null {
  const raw = localStorage.getItem('gns_handle');
  if (!raw) return null;

  // FIXED: Normalize - remove @ prefix and lowercase
  const normalized = raw.replace(/^@/, '').toLowerCase();
  console.log(`🔑 getCurrentUserHandle: "${raw}" → "${normalized}"`);
  return normalized;
}

// ===========================================
// GET DEFAULT FACET FROM LOCAL STORAGE
// ===========================================

interface FacetData {
  id: string;
  type: string;
  name: string;
  displayName?: string;
  tagline?: string;
  bio?: string;
  avatar?: string;
  cover?: string;
  emoji?: string;
  links?: Array<{ id: string; type: string; url: string; label?: string }>;
  skills?: string[];
  interests?: string[];
  status?: { text?: string; emoji?: string; available?: boolean };
}

function getDefaultFacet(): FacetData | null {
  try {
    const facetsJson = localStorage.getItem('gns_facets');
    if (!facetsJson) {
      console.log('⚠️ No gns_facets in localStorage');
      return null;
    }

    const facets: FacetData[] = JSON.parse(facetsJson);
    const defaultFacet = facets.find(f => f.type === 'defaultPersonal');

    if (defaultFacet) {
      console.log('✅ Found defaultPersonal facet');
    } else {
      console.log('⚠️ No defaultPersonal facet in:', facets.map(f => f.type));
    }

    return defaultFacet || null;
  } catch (e) {
    console.error('❌ Failed to get facets:', e);
    return null;
  }
}

// ===========================================
// CALCULATE TRUST SCORE
// ===========================================

function calculateTrustScore(
  breadcrumbs: number,
  accountAgeDays: number,
  isVerified: boolean
): number {
  // Breadcrumbs: up to 40 points (0.5 per crumb, max 80 crumbs = 40)
  const breadcrumbScore = Math.min(40, breadcrumbs * 0.5);

  // Account age: up to 30 points (1 per month, max 30 months)
  const ageScore = Math.min(30, accountAgeDays / 30);

  // Verification: 30 points if handle claimed
  const verificationScore = isVerified ? 30 : 0;

  return Math.round(breadcrumbScore + ageScore + verificationScore);
}

function calculateAccountAge(createdAt?: string): number {
  if (!createdAt) return 0;
  try {
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

function buildTrustBreakdown(
  breadcrumbs: number,
  accountAgeDays: number,
  isVerified: boolean,
  trustScore: number
): TrustBreakdown {
  return {
    overall: trustScore,
    components: {
      consistency: {
        score: Math.min(100, breadcrumbs * 1.5),
        description: `${breadcrumbs} breadcrumbs collected`,
      },
      longevity: {
        score: Math.min(100, (accountAgeDays / 365) * 100),
        description: formatAccountAge(accountAgeDays),
      },
      activity: {
        score: Math.min(100, breadcrumbs * 3),
        description: 'Recent activity',
      },
      diversity: {
        score: 50, // TODO: Calculate from H3 cells
        description: 'Location diversity',
      },
      verification: {
        score: isVerified ? 100 : 0,
        description: isVerified ? 'Handle verified ✓' : 'Handle not claimed',
      },
    },
  };
}

function formatAccountAge(days: number): string {
  if (days < 30) return `${days} days old`;
  if (days < 365) return `${Math.floor(days / 30)} months old`;
  const years = (days / 365).toFixed(1);
  return `${years} years active`;
}

// ===========================================
// FETCH FROM BACKEND
// ===========================================

interface BackendProfile {
  handle: string;
  publicKey: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  coverImage?: string;
  location?: string;
  website?: string;
  trustScore?: number;
  breadcrumbCount?: number;
  isVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

async function fetchFromBackend(handle: string): Promise<BackendProfile | null> {
  try {
    // FIXED: Use regex to ensure only leading @ is removed
    const cleanHandle = handle.replace(/^@/, '').toLowerCase();
    console.log(`🌐 GET /web/profile/${cleanHandle}`);

    const response = await fetch(`${API_BASE}/web/profile/${cleanHandle}`);
    const json = await response.json();

    console.log('📥 Backend response:', json);

    if (json.success && json.data) {
      return json.data as BackendProfile;
    }
    return null;
  } catch (e) {
    console.error('❌ Backend fetch error:', e);
    return null;
  }
}

// ===========================================
// TRANSFORM TO GSITE PROFILE
// ===========================================

function transformToGSiteProfile(
  backend: BackendProfile,
  facet: FacetData | null,
  isOwnProfile: boolean
): GSiteProfile {
  const accountAgeDays = calculateAccountAge(backend.createdAt);
  const breadcrumbs = backend.breadcrumbCount || 0;
  const isVerified = backend.isVerified || false;

  // Calculate trust score (backend may have 0, so we calculate)
  const calculatedTrust = calculateTrustScore(breadcrumbs, accountAgeDays, isVerified);
  const trustScore = backend.trustScore && backend.trustScore > 0
    ? backend.trustScore
    : calculatedTrust;

  // For own profile, prefer facet data (fresher)
  // For others, use backend data
  const displayName = isOwnProfile && facet?.displayName
    ? facet.displayName
    : backend.displayName || backend.handle;

  const avatar = isOwnProfile && facet?.avatar
    ? facet.avatar
    : backend.avatarUrl;

  const bio = isOwnProfile && facet?.bio
    ? facet.bio
    : backend.bio;

  const tagline = isOwnProfile && facet?.tagline
    ? facet.tagline
    : undefined;

  const cover = isOwnProfile && facet?.cover
    ? facet.cover
    : backend.coverImage;

  // FIXED: Only use facet data for own profile
  const links = (isOwnProfile && facet?.links) ? facet.links : [];
  const skills = (isOwnProfile && facet?.skills) ? facet.skills : [];

  console.log(`📦 Transform: isOwn=${isOwnProfile}, hasFacet=${!!facet}, avatar=${!!avatar}`);

  return {
    // Identity
    handle: backend.handle,
    publicKey: backend.publicKey,
    isVerified,

    // Declared (from facet + backend)
    declared: {
      displayName,
      avatar: avatar ? { url: avatar } : undefined,
      cover: cover ? { url: cover } : undefined,
      bio,
      tagline,
      location: backend.location ? { city: backend.location } : undefined,
      website: backend.website,
      links: links.map(l => ({
        type: l.type,
        url: l.url,
        label: l.label,
      })),
      skills,
    },

    // Proven (from backend + calculated)
    proven: {
      trustScore,
      trustBreakdown: buildTrustBreakdown(breadcrumbs, accountAgeDays, isVerified, trustScore),
      breadcrumbCount: breadcrumbs,
      accountAgeDays,
      createdAt: backend.createdAt,
    },

    // Activity (TODO: fetch from separate endpoint)
    activity: {
      recentActions: [],
      dixPostCount: 0,
      transactionCount: 0,
      lastActive: backend.updatedAt,
    },

    // Legacy compatibility
    '@id': `@${backend.handle}`,
    '@type': 'Person',
  };
}

// Convert GSiteProfile back to GSite (for editing)
export function profileToGSite(profile: GSiteProfile): GSite {
  const declared = profile.declared;

  // Construct base GSite (Person)
  return {
    '@context': 'https://schema.gns.network/v1',
    '@type': 'Person',
    '@id': profile['@id'] || `@${profile.handle}`,
    name: declared.displayName || profile.handle,
    bio: declared.bio,
    avatar: declared.avatar,
    cover: declared.cover,
    links: declared.links?.map(l => ({
      type: l.type,
      url: l.url,
      label: l.label
    })) || [],
    actions: DEFAULT_ACTIONS,
    version: 1,
    // Person specific
    skills: declared.skills || [],
    interests: [],
    facets: [],
    // status? We don't have status in GSiteProfile declared yet efficiently, 
    // but we can add it if we expand GSiteProfile later.
  } as PersonGSite;
}

// ===========================================
// MAIN FETCH FUNCTION
// ===========================================

export async function getGSite(identifier: string): Promise<GSiteResult> {
  try {
    // FIXED: Normalize identifier
    const cleanHandle = identifier.replace(/^@/, '').toLowerCase();
    const currentUser = getCurrentUserHandle(); // Already normalized
    const isOwnProfile = currentUser !== null && currentUser === cleanHandle;

    console.log(`📋 Loading GSite: "${cleanHandle}" (currentUser: "${currentUser}", isOwn: ${isOwnProfile})`);

    // Fetch from backend
    const backend = await fetchFromBackend(cleanHandle);

    if (!backend) {
      return { success: false, error: 'Profile not found', isOwnProfile };
    }

    // Get facet for own profile
    const facet = isOwnProfile ? getDefaultFacet() : null;

    // Transform
    const profile = transformToGSiteProfile(backend, facet, isOwnProfile);

    console.log('✅ GSiteProfile ready');

    return { success: true, data: profile, isOwnProfile };
  } catch (e) {
    console.error('❌ getGSite error:', e);
    return { success: false, error: String(e), isOwnProfile: false };
  }
}

// ===========================================
// CACHE
// ===========================================

const CACHE_KEY = 'gns_gsite_cache';
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

interface CacheEntry {
  profile: GSiteProfile;
  timestamp: number;
  isOwnProfile: boolean;
}

function getCached(handle: string): CacheEntry | null {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const key = handle.replace(/^@/, '').toLowerCase();
    const entry = cache[key];

    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry;
    }
    return null;
  } catch {
    return null;
  }
}

function setCache(handle: string, profile: GSiteProfile, isOwnProfile: boolean): void {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const key = handle.replace(/^@/, '').toLowerCase();
    cache[key] = { profile, timestamp: Date.now(), isOwnProfile };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore
  }
}

// ===========================================
// CACHED FETCH (MAIN EXPORT)
// ===========================================

export async function getGSiteCached(identifier: string): Promise<GSiteResult> {
  const cleanHandle = identifier.replace(/^@/, '').toLowerCase();
  const currentUser = getCurrentUserHandle();
  const isOwnProfile = currentUser !== null && currentUser === cleanHandle;

  // Skip cache for own profile (always fresh)
  if (!isOwnProfile) {
    const cached = getCached(cleanHandle);
    if (cached) {
      console.log('📦 Using cached GSite');
      return { success: true, data: cached.profile, isOwnProfile: cached.isOwnProfile };
    }
  }

  // Fetch fresh
  const result = await getGSite(identifier);

  // Cache success (but not own profile)
  if (result.success && result.data && !isOwnProfile) {
    setCache(cleanHandle, result.data, result.isOwnProfile);
  }

  return result;
}

// ===========================================
// CLEAR CACHE
// ===========================================

export function clearGSiteCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

// ===========================================
// SAVE/VALIDATE (FOR CREATOR)
// ===========================================

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export async function validateGSite(gsite: Partial<GSite>): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  if (!gsite.name) errors.push({ path: 'name', message: 'Name is required' });

  return {
    valid: errors.length === 0,
    errors
  };
}

// Placeholder - implement with actual signing when needed
// Placeholder - implement with actual signing when needed
export async function saveGSite(gsite: Partial<GSite>): Promise<{ success: boolean; data?: GSite; error?: string }> {
  try {
    console.log('💾 Saving to local storage:', gsite);

    // 1. Get existing facets
    const rawFacets = localStorage.getItem('gns_facets');
    let facets: FacetData[] = rawFacets ? JSON.parse(rawFacets) : [];

    // 2. Map GSite to FacetData
    const facetType = 'defaultPersonal';
    let index = facets.findIndex(f => f.type === facetType);

    // Create updated facet data
    const updatedFacet: FacetData = {
      id: index >= 0 ? facets[index].id : crypto.randomUUID(),
      type: facetType,
      name: gsite.name || '',
      displayName: gsite.name,
      tagline: gsite.tagline,
      bio: gsite.bio,
      avatar: gsite.avatar?.url,
      cover: gsite.cover?.url,
      links: gsite.links?.map((l: any) => ({
        id: crypto.randomUUID(),
        type: l.type,
        url: l.url,
        label: l.label
      })),
      skills: (gsite as any).skills,
      interests: (gsite as any).interests,
      status: (gsite as any).status,
    };

    if (index >= 0) {
      facets[index] = { ...facets[index], ...updatedFacet };
    } else {
      facets.push(updatedFacet);
    }

    // 3. Save
    localStorage.setItem('gns_facets', JSON.stringify(facets));

    // 4. Clear cache
    clearGSiteCache();

    return { success: true, data: gsite as GSite };
  } catch (e) {
    console.error('❌ Save error:', e);
    return { success: false, error: String(e) };
  }
}

// Convert local facet to GSite (PersonGSite)
export function getLocalGSite(handle: string): PersonGSite | null {
  const defaultFacet = getDefaultFacet();
  if (!defaultFacet) return null;

  return {
    '@context': 'https://schema.gns.network/v1',
    '@type': 'Person',
    '@id': `@${handle}`,
    name: defaultFacet.displayName || defaultFacet.name,
    tagline: defaultFacet.tagline,
    bio: defaultFacet.bio,
    avatar: defaultFacet.avatar ? { url: defaultFacet.avatar } : undefined,
    cover: defaultFacet.cover ? { url: defaultFacet.cover } : undefined,
    links: defaultFacet.links ? defaultFacet.links.map(l => ({
      type: l.type,
      url: l.url,
      label: l.label
    })) : [],
    skills: defaultFacet.skills || [],
    interests: defaultFacet.interests || [],
    status: defaultFacet.status,
    version: 1,
    actions: DEFAULT_ACTIONS,
    facets: []
  } as PersonGSite;
}

// ===========================================
// DEBUG HELPER
// ===========================================

export function debugGSiteStorage(): void {
  console.log('=== GSite Debug ===');
  const raw = localStorage.getItem('gns_handle');
  console.log('gns_handle (raw):', raw);
  console.log('gns_handle (normalized):', raw?.replace(/^@/, '').toLowerCase());

  const facets = localStorage.getItem('gns_facets');
  if (facets) {
    try {
      const parsed = JSON.parse(facets);
      console.log('gns_facets:', parsed.length, 'facets');
      parsed.forEach((f: any) => console.log(`  - ${f.type}: ${f.displayName || f.name}`));
    } catch {
      console.log('gns_facets: [parse error]');
    }
  }
  console.log('===================');
}

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).debugGSite = debugGSiteStorage;
}
