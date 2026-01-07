// ===========================================
// GNS BROWSER - PROFILE SERVICE
// ===========================================
// Local storage + API sync for profile facets

import { 
  ProfileFacet, 
  FacetCollection, 
  ProfileData, 
  ProfileLink,
  createDefaultFacet 
} from '../types/profile';
import { getPublicKey, signString } from './tauri';

const API_BASE = 'https://gns-browser-production.up.railway.app';
const STORAGE_KEY = 'gns_facets';
const DEFAULT_FACET_KEY = 'gns_default_facet_id';

// ===========================================
// LOCAL STORAGE
// ===========================================

/**
 * Get all facets from local storage
 */
export function getLocalFacets(): ProfileFacet[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Create default "me" facet
      const defaultFacet = createDefaultFacet();
      saveLocalFacets([defaultFacet]);
      return [defaultFacet];
    }
    
    const facets = JSON.parse(stored) as ProfileFacet[];
    
    // Ensure default facet exists
    if (!facets.some(f => f.type === 'defaultPersonal')) {
      const defaultFacet = createDefaultFacet();
      facets.unshift(defaultFacet);
      saveLocalFacets(facets);
    }
    
    return facets;
  } catch (e) {
    console.error('Error loading facets:', e);
    const defaultFacet = createDefaultFacet();
    return [defaultFacet];
  }
}

/**
 * Save facets to local storage
 */
export function saveLocalFacets(facets: ProfileFacet[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(facets));
  } catch (e) {
    console.error('Error saving facets:', e);
  }
}

/**
 * Get a single facet by ID
 */
export function getLocalFacet(id: string): ProfileFacet | null {
  const facets = getLocalFacets();
  // Normalize 'default' to 'me'
  const normalizedId = id === 'default' ? 'me' : id;
  return facets.find(f => f.id === normalizedId) || null;
}

/**
 * Save a single facet (add or update)
 */
export function saveLocalFacet(facet: ProfileFacet): void {
  const facets = getLocalFacets();
  const index = facets.findIndex(f => f.id === facet.id);
  
  if (index >= 0) {
    facets[index] = { ...facet, updatedAt: new Date().toISOString() };
  } else {
    facets.push(facet);
  }
  
  saveLocalFacets(facets);
}

/**
 * Delete a facet by ID
 */
export function deleteLocalFacet(id: string): boolean {
  const facets = getLocalFacets();
  const facet = facets.find(f => f.id === id);
  
  // Can't delete default or system facets
  if (!facet || facet.type === 'defaultPersonal' || facet.type === 'system') {
    return false;
  }
  
  const filtered = facets.filter(f => f.id !== id);
  saveLocalFacets(filtered);
  return true;
}

/**
 * Get the default facet ID
 */
export function getDefaultFacetId(): string {
  return localStorage.getItem(DEFAULT_FACET_KEY) || 'me';
}

/**
 * Set the default facet ID
 */
export function setDefaultFacetId(id: string): void {
  localStorage.setItem(DEFAULT_FACET_KEY, id);
  
  // Update isDefault flag on all facets
  const facets = getLocalFacets();
  const updated = facets.map(f => ({
    ...f,
    isDefault: f.id === id,
    updatedAt: f.id === id ? new Date().toISOString() : f.updatedAt,
  }));
  saveLocalFacets(updated);
}

/**
 * Get the default facet
 */
export function getDefaultFacet(): ProfileFacet {
  const facets = getLocalFacets();
  const defaultId = getDefaultFacetId();
  
  // Try by ID first
  let facet = facets.find(f => f.id === defaultId);
  if (facet) return facet;
  
  // Fall back to defaultPersonal type
  facet = facets.find(f => f.type === 'defaultPersonal');
  if (facet) return facet;
  
  // Fall back to first facet
  return facets[0] || createDefaultFacet();
}

/**
 * Get facet collection
 */
export function getFacetCollection(): FacetCollection {
  return {
    facets: getLocalFacets(),
    defaultFacetId: getDefaultFacetId(),
  };
}

/**
 * Check if a facet ID already exists
 */
export function facetExists(id: string): boolean {
  const facets = getLocalFacets();
  return facets.some(f => f.id === id);
}

// ===========================================
// PROFILE DATA HELPERS
// ===========================================

/**
 * Convert facet to ProfileData (legacy compatibility)
 */
export function facetToProfileData(facet: ProfileFacet): ProfileData {
  return {
    displayName: facet.displayName,
    bio: facet.bio,
    avatarUrl: facet.avatarUrl,
    links: facet.links,
    locationPublic: false,
    locationResolution: 7,
  };
}

/**
 * Create facet from ProfileData (migration)
 */
export function profileDataToFacet(data: ProfileData): ProfileFacet {
  return createDefaultFacet({
    displayName: data.displayName,
    bio: data.bio,
    avatarUrl: data.avatarUrl,
    links: data.links,
  });
}

// ===========================================
// NETWORK SYNC
// ===========================================

/**
 * Sync profile to network (GNS record)
 */
export async function syncProfileToNetwork(facet: ProfileFacet): Promise<{ 
  success: boolean; 
  message?: string; 
  error?: string;
}> {
  try {
    const publicKey = await getPublicKey();
    if (!publicKey) {
      return { success: false, error: 'No identity found' };
    }

    const timestamp = new Date().toISOString();
    const signData = `profile:${timestamp}`;
    const signature = await signString(signData);

    if (!signature) {
      return { success: false, error: 'Failed to sign request' };
    }

    // Convert facet to profile module format
    const profileModule = {
      id: 'profile',
      schema: 'gns.module.profile/v1',
      name: 'Profile',
      isPublic: true,
      config: {
        display_name: facet.displayName,
        bio: facet.bio,
        avatar_url: facet.avatarUrl,
        links: facet.links.map(l => ({
          type: l.type,
          label: l.label,
          url: l.url,
        })),
      },
    };

    const response = await fetch(`${API_BASE}/records/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GNS-PublicKey': publicKey,
        'X-GNS-Signature': signature,
        'X-GNS-Timestamp': timestamp,
      },
      body: JSON.stringify({
        modules: [profileModule],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Sync failed' };
    }

    return { success: true, message: 'Profile synced to network' };
  } catch (e) {
    console.error('Profile sync error:', e);
    return { success: false, error: String(e) };
  }
}

/**
 * Fetch profile from network
 */
export async function fetchProfileFromNetwork(handle: string): Promise<ProfileData | null> {
  try {
    const response = await fetch(`${API_BASE}/identity/@${handle}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success || !data.data?.record_json) return null;

    const record = data.data.record_json;
    const profileModule = record.modules?.find((m: any) => m.id === 'profile');
    
    if (!profileModule?.config) return null;

    const config = profileModule.config;
    return {
      displayName: config.display_name,
      bio: config.bio,
      avatarUrl: config.avatar_url,
      links: (config.links || []).map((l: any) => ({
        type: l.type || 'website',
        label: l.label,
        url: l.url,
      })),
      locationPublic: config.location_public || false,
      locationResolution: config.location_resolution || 7,
    };
  } catch (e) {
    console.error('Fetch profile error:', e);
    return null;
  }
}

// ===========================================
// AVATAR HELPERS
// ===========================================

/**
 * Convert file to base64 data URL
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Resize image to max dimensions
 */
export async function resizeImage(
  dataUrl: string, 
  maxWidth = 400, 
  maxHeight = 400, 
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Extract base64 data from data URL
 */
export function extractBase64(dataUrl: string): string {
  if (dataUrl.includes(',')) {
    return dataUrl.split(',')[1];
  }
  return dataUrl;
}

/**
 * Decode base64 avatar to Uint8Array
 */
export function decodeAvatar(avatarUrl: string): Uint8Array | null {
  try {
    const base64 = extractBase64(avatarUrl);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error('Decode avatar error:', e);
    return null;
  }
}

// ===========================================
// LINK HELPERS
// ===========================================

/**
 * Auto-detect link type from URL
 */
export function detectLinkType(url: string): ProfileLink['type'] {
  const lower = url.toLowerCase();
  if (lower.includes('github.com')) return 'github';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
  if (lower.includes('linkedin.com')) return 'linkedin';
  return 'website';
}

/**
 * Ensure URL has protocol
 */
export function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

/**
 * Get link placeholder based on type
 */
export function getLinkPlaceholder(type: ProfileLink['type']): string {
  switch (type) {
    case 'twitter': return 'twitter.com/username';
    case 'linkedin': return 'linkedin.com/in/username';
    case 'github': return 'github.com/username';
    default: return 'https://...';
  }
}
