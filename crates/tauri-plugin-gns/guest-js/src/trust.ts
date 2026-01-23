/**
 * @file GNS Trust System
 * @description Trust score calculation and identity verification via Proof-of-Trajectory
 * @module @anthropic/tauri-plugin-gns-api/trust
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  TrustScore,
  TrustTier,
  TrustVerification,
  TrustRequirements,
  TrustComponents,
} from './types';

/**
 * Get the trust score for the active identity.
 * 
 * Trust score is calculated from:
 * - Trajectory quality (pattern consistency)
 * - Temporal consistency (regular collection)
 * - Chain integrity (valid hash chains)
 * - Epoch reliability (published epochs)
 * - Geographic diversity (unique locations)
 * 
 * @example
 * ```typescript
 * const score = await getTrustScore();
 * console.log(`Trust: ${score.score}% (${score.tier})`);
 * ```
 * 
 * @returns Trust score with breakdown
 */
export async function getTrustScore(): Promise<TrustScore> {
  return invoke<TrustScore>('plugin:gns|get_trust_score');
}

/**
 * Get detailed trust score with full component breakdown.
 * 
 * @example
 * ```typescript
 * const details = await getTrustDetails();
 * console.log(`Trajectory Quality: ${details.components.trajectoryQuality}%`);
 * console.log(`Geographic Diversity: ${details.components.geographicDiversity}%`);
 * ```
 * 
 * @returns Complete trust score analysis
 */
export async function getTrustDetails(): Promise<TrustScore> {
  return invoke<TrustScore>('plugin:gns|get_trust_details');
}

/**
 * Verify an identity meets specified trust requirements.
 * 
 * @example
 * ```typescript
 * const verification = await verifyIdentity('abc123...', {
 *   minTrustScore: 40,
 *   minBreadcrumbs: 200,
 * });
 * 
 * if (verification.isVerified) {
 *   console.log('Identity meets requirements');
 * } else {
 *   verification.checks.filter(c => !c.passed).forEach(c => {
 *     console.log(`Failed: ${c.name} - ${c.details}`);
 *   });
 * }
 * ```
 * 
 * @param publicKey - Identity to verify
 * @param requirements - Trust requirements to check
 * @returns Verification result with individual check results
 */
export async function verifyIdentity(
  publicKey?: string,
  requirements?: TrustRequirements
): Promise<TrustVerification> {
  return invoke<TrustVerification>('plugin:gns|verify_identity', {
    publicKey: publicKey ?? null,
    requirements: requirements ?? null,
  });
}

/**
 * Get the display name for a trust tier.
 * 
 * @example
 * ```typescript
 * getTierDisplayName('Rooted'); // 'Rooted'
 * ```
 */
export function getTierDisplayName(tier: TrustTier): string {
  return tier;
}

/**
 * Get the emoji for a trust tier.
 * 
 * @example
 * ```typescript
 * getTierEmoji('Verified'); // '⭐'
 * ```
 */
export function getTierEmoji(tier: TrustTier): string {
  const emojis: Record<TrustTier, string> = {
    Seedling: '🌱',
    Rooted: '🌿',
    Established: '🌲',
    Trusted: '🏔️',
    Verified: '⭐',
  };
  return emojis[tier];
}

/**
 * Get the color for a trust tier (hex).
 * 
 * @example
 * ```typescript
 * getTierColor('Trusted'); // '#3b82f6'
 * ```
 */
export function getTierColor(tier: TrustTier): string {
  const colors: Record<TrustTier, string> = {
    Seedling: '#9ca3af',   // Gray
    Rooted: '#22c55e',     // Green
    Established: '#3b82f6', // Blue
    Trusted: '#a855f7',    // Purple
    Verified: '#f59e0b',   // Gold
  };
  return colors[tier];
}

/**
 * Get the minimum score for a trust tier.
 * 
 * @example
 * ```typescript
 * getTierMinScore('Rooted'); // 20
 * ```
 */
export function getTierMinScore(tier: TrustTier): number {
  const minScores: Record<TrustTier, number> = {
    Seedling: 0,
    Rooted: 20,
    Established: 40,
    Trusted: 60,
    Verified: 80,
  };
  return minScores[tier];
}

/**
 * Determine trust tier from a score.
 * 
 * @example
 * ```typescript
 * getTierFromScore(45); // 'Established'
 * ```
 */
export function getTierFromScore(score: number): TrustTier {
  if (score >= 80) return 'Verified';
  if (score >= 60) return 'Trusted';
  if (score >= 40) return 'Established';
  if (score >= 20) return 'Rooted';
  return 'Seedling';
}

/**
 * Get preset trust requirements for handle claiming.
 * 
 * @returns Requirements for claiming a @handle
 */
export function getHandleClaimRequirements(): TrustRequirements {
  return {
    minTrustScore: 20,
    minBreadcrumbs: 100,
    minAccountAgeDays: 7,
    minUniqueLocations: 10,
    requiredTier: 'Rooted',
  };
}

/**
 * Get preset trust requirements for payments.
 * 
 * @returns Requirements for sending/receiving payments
 */
export function getPaymentRequirements(): TrustRequirements {
  return {
    minTrustScore: 40,
    minBreadcrumbs: 200,
    minAccountAgeDays: 14,
    minUniqueLocations: 20,
    requiredTier: 'Established',
  };
}

/**
 * Get empty trust requirements (no verification needed).
 * 
 * @returns Empty requirements object
 */
export function getNoRequirements(): TrustRequirements {
  return {};
}

/**
 * Check if an identity meets handle claim requirements.
 * 
 * @example
 * ```typescript
 * if (await canClaimHandle()) {
 *   await claimHandle('myhandle');
 * }
 * ```
 */
export async function canClaimHandle(publicKey?: string): Promise<boolean> {
  const verification = await verifyIdentity(publicKey, getHandleClaimRequirements());
  return verification.isVerified;
}

/**
 * Check if an identity meets payment requirements.
 * 
 * @example
 * ```typescript
 * if (await canSendPayments()) {
 *   await sendPayment('@alice', 10);
 * }
 * ```
 */
export async function canSendPayments(publicKey?: string): Promise<boolean> {
  const verification = await verifyIdentity(publicKey, getPaymentRequirements());
  return verification.isVerified;
}

/**
 * Format a trust score for display.
 * 
 * @example
 * ```typescript
 * formatTrustScore(score); // '45% 🌲 Established'
 * ```
 */
export function formatTrustScore(score: TrustScore): string {
  return `${score.score}% ${getTierEmoji(score.tier)} ${score.tier}`;
}

/**
 * Get a human-readable description of trust components.
 * 
 * @example
 * ```typescript
 * const desc = describeTrustComponents(score.components);
 * console.log(desc.trajectoryQuality); // 'Strong trajectory patterns detected'
 * ```
 */
export function describeTrustComponents(components: TrustComponents): Record<keyof TrustComponents, string> {
  const describe = (value: number, lowDesc: string, midDesc: string, highDesc: string): string => {
    if (value < 30) return lowDesc;
    if (value < 70) return midDesc;
    return highDesc;
  };

  return {
    trajectoryQuality: describe(
      components.trajectoryQuality,
      'Trajectory patterns are still developing',
      'Good trajectory patterns detected',
      'Strong trajectory patterns detected'
    ),
    temporalConsistency: describe(
      components.temporalConsistency,
      'Breadcrumb collection is irregular',
      'Regular breadcrumb collection',
      'Excellent collection consistency'
    ),
    chainIntegrity: describe(
      components.chainIntegrity,
      'Hash chain has some gaps',
      'Hash chain is mostly complete',
      'Perfect hash chain integrity'
    ),
    epochReliability: describe(
      components.epochReliability,
      'Few epochs published',
      'Good epoch publishing rate',
      'Excellent epoch publishing'
    ),
    geographicDiversity: describe(
      components.geographicDiversity,
      'Limited geographic coverage',
      'Good geographic diversity',
      'Excellent geographic diversity'
    ),
  };
}

/**
 * Calculate days until reaching a target trust tier.
 * 
 * This is an estimate based on current progress rate.
 * 
 * @example
 * ```typescript
 * const days = estimateDaysToTier(score, 'Trusted');
 * console.log(`About ${days} days to reach Trusted tier`);
 * ```
 */
export function estimateDaysToTier(
  currentScore: TrustScore,
  targetTier: TrustTier
): number | null {
  const targetMin = getTierMinScore(targetTier);
  
  if (currentScore.score >= targetMin) {
    return 0; // Already at or above target
  }
  
  if (currentScore.accountAgeDays === 0) {
    return null; // Cannot estimate without history
  }
  
  // Estimate rate of score increase per day
  const dailyRate = currentScore.score / currentScore.accountAgeDays;
  
  if (dailyRate <= 0) {
    return null; // No progress
  }
  
  const scoreDiff = targetMin - currentScore.score;
  return Math.ceil(scoreDiff / dailyRate);
}
