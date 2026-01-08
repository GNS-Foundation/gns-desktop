// ===========================================
// GNS API Service for Panthera Browser
// Connects to api.gcrumbs.com
// ===========================================

// UPDATE THIS TO YOUR ACTUAL RAILWAY BACKEND URL!
export const GNS_API_BASE = process.env.REACT_APP_GNS_API_URL || 'https://gns-browser-production.up.railway.app';

// Sample Profiles for Demo/Fallback
export const SAMPLE_PROFILES = {
  'panthera': {
    handle: 'panthera',
    name: 'Panthera Browser',
    type: 'organization',
    avatar: '🦁',
    bio: 'The official browser for the GNS Protocol. Browse the identity web securely and privately.',
    color: '#0EA5E9',
    stats: { trustScore: 1.0, breadcrumbs: 15420, verified: true },
    links: ['gns.io', 'github.com/gns-protocol'],
    publicKey: 'GNS7x...92kL',
  },
  'camilo': {
    handle: 'camilo',
    name: 'Camilo Ayerbe',
    type: 'person',
    avatar: '👨‍💻',
    bio: 'Building the future of identity. Founder @GNS.',
    color: '#8B5CF6',
    stats: { trustScore: 0.98, breadcrumbs: 8500, verified: true },
    links: ['twitter.com/camilo', 'camilo.eth'],
  },
  'echo': {
    handle: 'echo',
    name: 'Echo Bot',
    type: 'bot',
    avatar: '🤖',
    bio: 'I echo back everything you say! Useful for testing connectivity.',
    color: '#10B981',
    stats: { trustScore: 0.95, breadcrumbs: 42000, verified: true },
  },
  'sf': {
    handle: 'sf',
    name: 'San Francisco',
    type: 'landmark',
    avatar: '🌉',
    bio: 'The Golden City. Foggy mornings and tech dreams.',
    color: '#F59E0B',
    stats: { trustScore: 0.92, breadcrumbs: 120000, verified: true },
    links: ['sf.gov'],
  },
};

/**
 * Fetch profile by @handle
 * GET /web/profile/:handle
 */
export async function getProfileByHandle(handle) {
  const cleanHandle = handle.replace(/^@/, '').toLowerCase();

  try {
    const response = await fetch(`${GNS_API_BASE}/web/profile/${cleanHandle}`);
    const data = await response.json();

    if (!data.success) {
      if (SAMPLE_PROFILES[cleanHandle]) {
        return { success: true, data: SAMPLE_PROFILES[cleanHandle] };
      }
      return { success: false, error: data.error || 'Profile not found' };
    }

    // Transform API response to Panthera profile format
    return {
      success: true,
      data: transformApiProfile(data.data),
    };
  } catch (error) {
    if (SAMPLE_PROFILES[cleanHandle]) {
      return { success: true, data: SAMPLE_PROFILES[cleanHandle] };
    }
    console.error('GNS API error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Resolve handle to public key
 * GET /handles/:handle
 */
export async function resolveHandle(handle) {
  const cleanHandle = handle.replace(/^@/, '').toLowerCase();

  try {
    const response = await fetch(`${GNS_API_BASE}/aliases/${cleanHandle}`);
    const data = await response.json();

    if (!data.success) {
      return { success: false, error: data.error || 'Handle not found' };
    }

    return {
      success: true,
      data: {
        handle: data.data.handle,
        publicKey: data.data.public_key,
        encryptionKey: data.data.encryption_key,
      },
    };
  } catch (error) {
    console.error('GNS API error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Search identities
 * GET /web/search?q=:query
 */
export async function searchIdentities(query, options = {}) {
  const { type = 'all', limit = 20 } = options;
  const cleanQuery = query.replace(/^@/, '').toLowerCase();

  try {
    const params = new URLSearchParams({
      q: cleanQuery,
      type,
      limit: limit.toString(),
    });

    const response = await fetch(`${GNS_API_BASE}/web/search?${params}`);
    const data = await response.json();

    if (!data.success) {
      return { success: false, error: data.error || 'Search failed', data: [] };
    }

    return {
      success: true,
      data: (data.data || []).map(transformApiProfile),
    };
  } catch (error) {
    console.error('GNS API error:', error);
    return { success: false, error: 'Network error', data: [] };
  }
}

/**
 * Transform API profile to Panthera format
 */
function transformApiProfile(apiProfile) {
  if (!apiProfile) return null;

  // Determine profile type based on handle or modules
  let type = 'person';
  if (apiProfile.handle === 'echo') {
    type = 'bot';
  } else if (apiProfile.modules?.some(m => m.schema?.includes('organization'))) {
    type = 'organization';
  } else if (apiProfile.modules?.some(m => m.schema?.includes('landmark'))) {
    type = 'landmark';
  }

  // Extract theme from modules if present
  const themeModule = apiProfile.modules?.find(m =>
    m.schema?.includes('theme') || m.id === 'theme'
  );

  return {
    handle: apiProfile.handle,
    name: apiProfile.displayName || apiProfile.display_name || `@${apiProfile.handle}`,
    tagline: apiProfile.location || apiProfile.website || '',
    type,
    avatar: apiProfile.avatarUrl || apiProfile.avatar_url || getDefaultAvatar(type),
    avatarUrl: apiProfile.avatarUrl || apiProfile.avatar_url,
    bio: apiProfile.bio || '',
    publicKey: apiProfile.publicKey || apiProfile.public_key,
    stats: {
      trustScore: formatTrustScore(apiProfile.trustScore || apiProfile.trust_score),
      breadcrumbs: formatBreadcrumbs(apiProfile.breadcrumbCount || apiProfile.breadcrumb_count),
      verified: apiProfile.isVerified || apiProfile.is_verified || false,
    },
    links: extractLinks(apiProfile),
    color: themeModule?.config?.primaryColor || getDefaultColor(type),
    theme: themeModule?.config || null,
    modules: apiProfile.modules || [],
    createdAt: apiProfile.createdAt || apiProfile.created_at,
    updatedAt: apiProfile.updatedAt || apiProfile.updated_at,
  };
}

/**
 * Get default avatar emoji by type
 */
function getDefaultAvatar(type) {
  const avatars = {
    person: '👤',
    organization: '🏢',
    landmark: '🏛️',
    bot: '🤖',
  };
  return avatars[type] || '👤';
}

/**
 * Get default color by type
 */
function getDefaultColor(type) {
  const colors = {
    person: '#8B5CF6',
    organization: '#0EA5E9',
    landmark: '#D97706',
    bot: '#10B981',
  };
  return colors[type] || '#0EA5E9';
}

/**
 * Format trust score for display
 */
function formatTrustScore(score) {
  if (!score && score !== 0) return 'N/A';
  return `${(score * 100).toFixed(1)}%`;
}

/**
 * Format breadcrumb count for display
 */
function formatBreadcrumbs(count) {
  if (!count && count !== 0) return '0';
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

/**
 * Extract links from profile
 */
function extractLinks(profile) {
  const links = [];

  if (profile.website) {
    links.push(profile.website);
  }

  // Extract from modules
  const profileModule = profile.modules?.find(m =>
    m.schema?.includes('profile') || m.id === 'profile'
  );

  if (profileModule?.config?.links) {
    profileModule.config.links.forEach(link => {
      if (link.url) links.push(link.url);
      else if (typeof link === 'string') links.push(link);
    });
  }

  return links;
}

export default {
  getProfileByHandle,
  resolveHandle,
  searchIdentities,
  SAMPLE_PROFILES
};
