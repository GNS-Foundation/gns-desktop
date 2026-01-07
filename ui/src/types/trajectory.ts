// ===========================================
// GNS BROWSER - TRAJECTORY TYPES (PHASE 2)
// ===========================================
// Types for proof-of-trajectory analytics

// ===========================================
// MAIN TRAJECTORY STATS
// ===========================================

export interface TrajectoryStats {
  // Core counts
  totalBreadcrumbs: number;
  uniqueCells: number;           // Unique H3 cells visited
  activeDays: number;            // Days with at least 1 breadcrumb
  
  // Geographic diversity
  countries: CountryVisit[];     // Countries visited (from H3 → reverse geocode)
  cities: CityVisit[];           // Cities visited
  
  // Streaks
  currentStreak: number;         // Current consecutive days
  longestStreak: number;         // All-time best streak
  lastActiveDate: string;        // ISO date of last breadcrumb
  
  // Time-based
  firstBreadcrumbAt: string;     // ISO date
  accountAgeDays: number;        // Days since first breadcrumb
  
  // Activity patterns (optional, for detailed view)
  weeklyDistribution?: number[]; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  hourlyDistribution?: number[]; // [0-23 hours]
  
  // Privacy-safe location summary
  primaryRegion?: string;        // "Bogotá, Colombia" or just country
  travelRadius?: number;         // Approximate km from "home"
}

// ===========================================
// LOCATION VISITS
// ===========================================

export interface CountryVisit {
  code: string;        // ISO 3166-1 alpha-2 (e.g., "CO", "US")
  name: string;        // Full name (e.g., "Colombia")
  count: number;       // Breadcrumb count in this country
  percentage: number;  // % of total breadcrumbs
  flag?: string;       // Emoji flag
}

export interface CityVisit {
  name: string;        // City name
  country: string;     // Country code
  count: number;       // Breadcrumb count
  percentage: number;  // % of total
}

// ===========================================
// STREAK DATA
// ===========================================

export interface StreakInfo {
  current: number;
  longest: number;
  lastActive: string;  // ISO date
  isActiveToday: boolean;
}

// ===========================================
// RAW BREADCRUMB (from Tauri)
// ===========================================

export interface LocalBreadcrumb {
  id: number;
  block_index: number;
  timestamp: string;           // ISO datetime
  location_cell: string;       // H3 hex
  location_resolution: number; // H3 resolution (7-12)
  context_digest: string;
  block_hash: string;
}

// ===========================================
// TAURI RESPONSES
// ===========================================

export interface TrajectoryResponse {
  success: boolean;
  stats?: TrajectoryStats;
  error?: string;
}

export interface BreadcrumbListResponse {
  success: boolean;
  breadcrumbs?: LocalBreadcrumb[];
  total?: number;
  error?: string;
}

// ===========================================
// HELPER: Country code to flag emoji
// ===========================================

export function countryCodeToFlag(code: string): string {
  const codePoints = code
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// ===========================================
// HELPER: Format trajectory stats for display
// ===========================================

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 100) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

export function formatPercentage(value: number): string {
  if (value >= 10) return `${Math.round(value)}%`;
  return `${value.toFixed(1)}%`;
}

export function getStreakEmoji(streak: number): string {
  if (streak >= 100) return '🔥🔥🔥';
  if (streak >= 30) return '🔥🔥';
  if (streak >= 7) return '🔥';
  if (streak >= 3) return '✨';
  return '🌱';
}

export function getStreakLabel(streak: number): string {
  if (streak >= 365) return 'Legendary!';
  if (streak >= 100) return 'On Fire!';
  if (streak >= 30) return 'Unstoppable';
  if (streak >= 7) return 'Hot Streak';
  if (streak >= 3) return 'Building';
  if (streak >= 1) return 'Active';
  return 'Start Today';
}

// ===========================================
// EMPTY/DEFAULT TRAJECTORY
// ===========================================

export const EMPTY_TRAJECTORY: TrajectoryStats = {
  totalBreadcrumbs: 0,
  uniqueCells: 0,
  activeDays: 0,
  countries: [],
  cities: [],
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  firstBreadcrumbAt: '',
  accountAgeDays: 0,
};
