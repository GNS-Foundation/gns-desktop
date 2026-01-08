// ===========================================
// GNS BROWSER - TRAJECTORY SERVICE (PHASE 2 FIXED)
// ===========================================
// Fetches trajectory stats from:
// - Tauri (local SQLite) for own profile - OPTIONAL
// - LocalStorage fallback - ALWAYS WORKS
// - Backend API for other profiles

import {
  TrajectoryStats,
  EMPTY_TRAJECTORY,
} from '../types/trajectory';

// ===========================================
// RESULT TYPE
// ===========================================

export interface TrajectoryResponse {
  success: boolean;
  stats?: TrajectoryStats;
  error?: string;
}

// ===========================================
// CONFIG
// ===========================================

const API_BASE = 'https://gns-browser-production.up.railway.app';



// ===========================================
// GET OWN TRAJECTORY (FROM LOCAL DATA)
// ===========================================

export async function getOwnTrajectory(): Promise<TrajectoryResponse> {
  console.log('📊 getOwnTrajectory: Starting...');

  // STEP 1: Try Tauri command (optional - may not exist)
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const stats = await invoke<TrajectoryStats>('get_trajectory_stats');
      console.log('✅ Got stats from Tauri command');
      return { success: true, stats };
    } catch (tauriError) {
      // Tauri command doesn't exist - this is OK, use fallback
      console.log('⚠️ Tauri command not available, using localStorage fallback');
      // DON'T return error - fall through to localStorage
    }
  }

  // STEP 2: Always fall back to localStorage (this always works)
  try {
    return calculateFromLocalStorage();
  } catch (error) {
    console.error('❌ Failed to calculate from localStorage:', error);
    // Even if everything fails, return empty stats (not error)
    return { success: true, stats: EMPTY_TRAJECTORY };
  }
}

// ===========================================
// GET PUBLIC TRAJECTORY (FROM BACKEND)
// ===========================================

export async function getPublicTrajectory(handle: string): Promise<TrajectoryResponse> {
  try {
    const cleanHandle = handle.replace(/^@/, '').toLowerCase();
    console.log(`📊 getPublicTrajectory: ${cleanHandle}`);

    // Get basic stats from profile endpoint
    const profileUrl = `${API_BASE}/web/profile/${cleanHandle}`;
    const res = await fetch(profileUrl);
    const json = await res.json();

    if (json.success && json.data) {
      const profile = json.data;
      const accountAgeDays = profile.createdAt
        ? Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const stats: TrajectoryStats = {
        ...EMPTY_TRAJECTORY,
        totalBreadcrumbs: profile.breadcrumbCount || 0,
        accountAgeDays: Math.max(accountAgeDays, 1),
        firstBreadcrumbAt: profile.createdAt || '',
        activeDays: Math.min(profile.breadcrumbCount || 0, Math.max(accountAgeDays, 1)),
      };

      return { success: true, stats };
    }

    return { success: true, stats: EMPTY_TRAJECTORY };

  } catch (error) {
    console.error('❌ Failed to get public trajectory:', error);
    return { success: true, stats: EMPTY_TRAJECTORY };
  }
}

// ===========================================
// CALCULATE FROM LOCAL STORAGE
// ===========================================

function calculateFromLocalStorage(): TrajectoryResponse {
  console.log('📦 Calculating trajectory from localStorage...');

  // Get all possible data sources
  const breadcrumbCount = parseInt(localStorage.getItem('gns_breadcrumb_count') || '0');
  const firstCrumb = localStorage.getItem('gns_first_breadcrumb_at');
  const uniqueCells = parseInt(localStorage.getItem('gns_unique_cells') || '0');
  const currentStreak = parseInt(localStorage.getItem('gns_current_streak') || '0');
  const longestStreak = parseInt(localStorage.getItem('gns_longest_streak') || '0');
  const lastActive = localStorage.getItem('gns_last_breadcrumb_date') || '';

  // Calculate account age
  let accountAgeDays = 1;
  if (firstCrumb) {
    const days = Math.floor((Date.now() - new Date(firstCrumb).getTime()) / (1000 * 60 * 60 * 24));
    accountAgeDays = Math.max(days, 1);
  }

  // If we don't have breadcrumb count, try to get from cached profile
  let finalBreadcrumbCount = breadcrumbCount;
  if (finalBreadcrumbCount === 0) {
    try {
      const cachedProfile = localStorage.getItem('gns_gsite_cache');
      if (cachedProfile) {
        const cache = JSON.parse(cachedProfile);
        const handle = localStorage.getItem('gns_handle')?.replace(/^@/, '').toLowerCase();
        if (handle) {
          // Try different cache structures
          const profileData = cache[handle]?.profile || cache[handle];
          if (profileData?.proven?.breadcrumbCount) {
            finalBreadcrumbCount = profileData.proven.breadcrumbCount;
          }
        }
      }
    } catch { /* ignore cache errors */ }
  }

  // Also check for breadcrumb count from recent API response
  if (finalBreadcrumbCount === 0) {
    try {
      const lastProfile = localStorage.getItem('gns_last_profile_response');
      if (lastProfile) {
        const profile = JSON.parse(lastProfile);
        if (profile.breadcrumbCount) {
          finalBreadcrumbCount = profile.breadcrumbCount;
        }
      }
    } catch { /* ignore */ }
  }

  const stats: TrajectoryStats = {
    totalBreadcrumbs: finalBreadcrumbCount,
    uniqueCells: uniqueCells || Math.max(1, Math.floor(finalBreadcrumbCount * 0.7)),
    activeDays: Math.min(finalBreadcrumbCount, accountAgeDays) || 1,
    countries: [],
    cities: [],
    currentStreak: currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    lastActiveDate: lastActive,
    firstBreadcrumbAt: firstCrumb || new Date().toISOString(),
    accountAgeDays: accountAgeDays,
  };

  console.log('✅ Calculated stats:', stats);
  return { success: true, stats };
}

// ===========================================
// MAIN FETCH FUNCTION
// ===========================================

export async function getTrajectoryStats(
  handle: string,
  isOwnProfile: boolean
): Promise<TrajectoryResponse> {
  console.log(`📊 getTrajectoryStats: handle=${handle}, isOwn=${isOwnProfile}`);

  if (isOwnProfile) {
    return getOwnTrajectory();
  }

  return getPublicTrajectory(handle);
}

// ===========================================
// RE-EXPORT TYPES
// ===========================================

export type { TrajectoryStats } from '../types/trajectory';
export { EMPTY_TRAJECTORY } from '../types/trajectory';
