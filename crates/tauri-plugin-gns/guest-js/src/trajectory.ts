/**
 * @file GNS Proof-of-Trajectory
 * @description Breadcrumb collection and epoch management for identity verification
 * @module @anthropic/tauri-plugin-gns-api/trajectory
 * 
 * Proof-of-Trajectory is the core innovation of GNS Protocol:
 * - Users collect location "breadcrumbs" as they move through the physical world
 * - Breadcrumbs are quantized to H3 hexagonal cells (privacy-preserving)
 * - Each breadcrumb is cryptographically chained to the previous one
 * - Breadcrumbs are bundled into "epochs" and published with Merkle roots
 * - Trust is earned through physical presence, not purchased or faked
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  Breadcrumb,
  BreadcrumbQuery,
  EpochHeader,
  CollectionStatus,
} from './types';

/**
 * Start collecting breadcrumbs.
 * 
 * This begins periodic location sampling based on configured interval.
 * Breadcrumbs are stored locally until published in an epoch.
 * 
 * @example
 * ```typescript
 * await startCollection();
 * console.log('Breadcrumb collection started');
 * ```
 */
export async function startCollection(): Promise<void> {
  return invoke<void>('plugin:gns|start_collection');
}

/**
 * Stop collecting breadcrumbs.
 * 
 * @example
 * ```typescript
 * await stopCollection();
 * ```
 */
export async function stopCollection(): Promise<void> {
  return invoke<void>('plugin:gns|stop_collection');
}

/**
 * Get the current collection status.
 * 
 * @example
 * ```typescript
 * const status = await getCollectionStatus();
 * console.log(`Collected: ${status.totalCount} breadcrumbs`);
 * console.log(`Pending: ${status.pendingCount} (not yet published)`);
 * ```
 * 
 * @returns Current collection status
 */
export async function getCollectionStatus(): Promise<CollectionStatus> {
  return invoke<CollectionStatus>('plugin:gns|get_collection_status');
}

/**
 * Get breadcrumbs for the active identity.
 * 
 * @example
 * ```typescript
 * // Get all breadcrumbs
 * const all = await getBreadcrumbs();
 * 
 * // Get unpublished breadcrumbs
 * const pending = await getBreadcrumbs({ unpublishedOnly: true });
 * 
 * // Get recent breadcrumbs
 * const recent = await getBreadcrumbs({ limit: 50 });
 * ```
 * 
 * @param query - Optional query parameters
 * @returns Array of breadcrumbs
 */
export async function getBreadcrumbs(query?: BreadcrumbQuery): Promise<Breadcrumb[]> {
  return invoke<Breadcrumb[]>('plugin:gns|get_breadcrumbs', { query: query ?? null });
}

/**
 * Get the count of breadcrumbs for an identity.
 * 
 * @example
 * ```typescript
 * const count = await getBreadcrumbCount();
 * console.log(`Total breadcrumbs: ${count}`);
 * ```
 * 
 * @param publicKey - Optional identity (uses active if not specified)
 * @returns Breadcrumb count
 */
export async function getBreadcrumbCount(publicKey?: string): Promise<number> {
  return invoke<number>('plugin:gns|get_breadcrumb_count', { publicKey: publicKey ?? null });
}

/**
 * Publish unpublished breadcrumbs as a new epoch.
 * 
 * Epochs bundle breadcrumbs into a verifiable package:
 * 1. Breadcrumbs are organized into blocks
 * 2. A Merkle tree is computed from block hashes
 * 3. The epoch is signed with the identity's key
 * 4. The epoch is published to the network
 * 
 * @example
 * ```typescript
 * const epoch = await publishEpoch();
 * console.log(`Published epoch ${epoch.epochIndex} with ${epoch.blockCount} blocks`);
 * ```
 * 
 * @returns The published epoch header
 */
export async function publishEpoch(): Promise<EpochHeader> {
  return invoke<EpochHeader>('plugin:gns|publish_epoch');
}

/**
 * Get published epochs for an identity.
 * 
 * @example
 * ```typescript
 * const epochs = await getEpochs();
 * epochs.forEach(e => {
 *   console.log(`Epoch ${e.epochIndex}: ${e.startTime} - ${e.endTime}`);
 * });
 * ```
 * 
 * @param publicKey - Optional identity (uses active if not specified)
 * @returns Array of epoch headers
 */
export async function getEpochs(publicKey?: string): Promise<EpochHeader[]> {
  return invoke<EpochHeader[]>('plugin:gns|get_epochs', { publicKey: publicKey ?? null });
}

/**
 * Manually add a breadcrumb at the current location.
 * 
 * This is typically not needed as collection happens automatically.
 * Useful for testing or manual location check-ins.
 * 
 * @example
 * ```typescript
 * const breadcrumb = await addBreadcrumb(37.7749, -122.4194);
 * console.log(`Added breadcrumb at ${breadcrumb.h3Index}`);
 * ```
 * 
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @param accuracy - Optional accuracy in meters
 * @returns The created breadcrumb
 */
export async function addBreadcrumb(
  latitude: number,
  longitude: number,
  accuracy?: number
): Promise<Breadcrumb> {
  return invoke<Breadcrumb>('plugin:gns|add_breadcrumb', {
    latitude,
    longitude,
    accuracy: accuracy ?? null,
  });
}

/**
 * Verify the integrity of the breadcrumb chain.
 * 
 * Checks that:
 * - All hash chains are valid
 * - No gaps in the sequence
 * - All signatures are valid
 * 
 * @example
 * ```typescript
 * const result = await verifyChain();
 * if (result.valid) {
 *   console.log('Chain integrity verified');
 * } else {
 *   console.log(`Chain broken at breadcrumb ${result.brokenAt}`);
 * }
 * ```
 * 
 * @returns Verification result
 */
export async function verifyChain(): Promise<{
  valid: boolean;
  totalChecked: number;
  brokenAt?: string;
  error?: string;
}> {
  return invoke('plugin:gns|verify_chain');
}

/**
 * Get statistics about trajectory coverage.
 * 
 * @example
 * ```typescript
 * const stats = await getTrajectoryStats();
 * console.log(`Unique cells visited: ${stats.uniqueCells}`);
 * console.log(`Collection days: ${stats.activeDays}`);
 * ```
 * 
 * @returns Trajectory statistics
 */
export async function getTrajectoryStats(): Promise<{
  uniqueCells: number;
  totalBreadcrumbs: number;
  publishedBreadcrumbs: number;
  epochCount: number;
  firstBreadcrumbAt?: string;
  lastBreadcrumbAt?: string;
  activeDays: number;
  averagePerDay: number;
}> {
  return invoke('plugin:gns|get_trajectory_stats');
}

/**
 * Export trajectory data for backup.
 * 
 * @example
 * ```typescript
 * const data = await exportTrajectory();
 * // Save to file
 * ```
 * 
 * @returns Serialized trajectory data
 */
export async function exportTrajectory(): Promise<string> {
  return invoke<string>('plugin:gns|export_trajectory');
}

/**
 * Import trajectory data from backup.
 * 
 * @example
 * ```typescript
 * await importTrajectory(savedData);
 * ```
 * 
 * @param data - Serialized trajectory data
 */
export async function importTrajectory(data: string): Promise<void> {
  return invoke<void>('plugin:gns|import_trajectory', { data });
}

/**
 * Format H3 index for display.
 * 
 * @example
 * ```typescript
 * formatH3Index('87283472bffffff'); // '872834...fff'
 * ```
 */
export function formatH3Index(h3Index: string): string {
  if (h3Index.length <= 10) return h3Index;
  return `${h3Index.slice(0, 6)}...${h3Index.slice(-3)}`;
}

/**
 * Calculate the area of an H3 cell at a given resolution.
 * 
 * @example
 * ```typescript
 * getH3CellArea(7); // ~5.16 (km²)
 * ```
 * 
 * @param resolution - H3 resolution (0-15)
 * @returns Area in square kilometers
 */
export function getH3CellArea(resolution: number): number {
  // Approximate areas for each H3 resolution level
  const areas: Record<number, number> = {
    0: 4250546.848,
    1: 607220.978,
    2: 86745.854,
    3: 12392.264,
    4: 1770.323,
    5: 252.903,
    6: 36.129,
    7: 5.161,
    8: 0.737,
    9: 0.105,
    10: 0.015,
    11: 0.002,
    12: 0.0003,
    13: 0.00004,
    14: 0.000006,
    15: 0.0000009,
  };
  return areas[resolution] ?? 0;
}

/**
 * Get the recommended H3 resolution for privacy level.
 * 
 * Lower resolutions = more privacy, less precision.
 * Higher resolutions = less privacy, more precision.
 * 
 * @example
 * ```typescript
 * getRecommendedResolution('high');   // 6 (~36 km²)
 * getRecommendedResolution('medium'); // 7 (~5 km²)
 * getRecommendedResolution('low');    // 8 (~0.7 km²)
 * ```
 * 
 * @param privacyLevel - Desired privacy level
 * @returns Recommended H3 resolution
 */
export function getRecommendedResolution(privacyLevel: 'high' | 'medium' | 'low'): number {
  switch (privacyLevel) {
    case 'high': return 6;   // ~36 km² cells
    case 'medium': return 7; // ~5 km² cells (default)
    case 'low': return 8;    // ~0.7 km² cells
  }
}

/**
 * Check if enough breadcrumbs exist to publish an epoch.
 * 
 * @example
 * ```typescript
 * if (await canPublishEpoch()) {
 *   await publishEpoch();
 * }
 * ```
 * 
 * @param minBreadcrumbs - Minimum breadcrumbs required (default from config)
 * @returns True if epoch can be published
 */
export async function canPublishEpoch(minBreadcrumbs = 10): Promise<boolean> {
  const status = await getCollectionStatus();
  return status.pendingCount >= minBreadcrumbs;
}

/**
 * Format a breadcrumb for display.
 * 
 * @example
 * ```typescript
 * formatBreadcrumb(bc); // '🌱 872834...fff at 2024-01-15 14:30'
 * ```
 */
export function formatBreadcrumb(breadcrumb: Breadcrumb): string {
  const icon = breadcrumb.published ? '✓' : '○';
  const time = new Date(breadcrumb.timestamp).toLocaleString();
  return `${icon} ${formatH3Index(breadcrumb.h3Index)} at ${time}`;
}
