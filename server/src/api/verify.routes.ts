// ===========================================
// GNS API - PROOF OF HUMANITY VERIFICATION
// /v1/verify/* endpoints
// ===========================================
// 
// This is GNS's core differentiator - verifying humanity through
// proof-of-trajectory rather than biometrics.
//
// Verification Levels:
// - none: < 10 breadcrumbs (insufficient data)
// - basic: 10-49 breadcrumbs, trust score < 20
// - standard: 50-99 breadcrumbs, trust score 20-49  
// - advanced: 100-499 breadcrumbs, trust score 50-79
// - maximum: 500+ breadcrumbs, trust score 80+
// ===========================================

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as db from '../db';
import { 
  verifySignature, 
  isValidPublicKey, 
  canonicalJson,
  generateNonce,
} from '../crypto';
import type {
  ApiResponse,
  ProofOfHumanity,
  VerificationLevel,
  VerificationChallenge,
  CreateChallengeRequest,
  SubmitChallengeRequest,
} from '../types/api.types';

const router = Router();

// ===========================================
// IN-MEMORY CHALLENGE STORE
// In production, use Redis with TTL
// ===========================================

interface StoredChallenge {
  challenge_id: string;
  challenge: string;
  public_key: string;
  require_fresh_breadcrumb: boolean;
  allowed_h3_cells?: string[];
  created_at: number;
  expires_at: number;
}

const pendingChallenges = new Map<string, StoredChallenge>();

// Cleanup expired challenges every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, challenge] of pendingChallenges.entries()) {
    if (now > challenge.expires_at) {
      pendingChallenges.delete(id);
    }
  }
}, 5 * 60 * 1000);

// ===========================================
// VERIFICATION LEVEL CALCULATION
// ===========================================

/**
 * Calculate verification level based on breadcrumbs and trust score
 */
function calculateVerificationLevel(
  breadcrumbs: number,
  trustScore: number
): VerificationLevel {
  if (breadcrumbs < 10) return 'none';
  if (breadcrumbs < 50 || trustScore < 20) return 'basic';
  if (breadcrumbs < 100 || trustScore < 50) return 'standard';
  if (breadcrumbs < 500 || trustScore < 80) return 'advanced';
  return 'maximum';
}

/**
 * Check if actual level meets or exceeds required level
 */
function meetsMinimumLevel(actual: VerificationLevel, required: VerificationLevel): boolean {
  const levels: VerificationLevel[] = ['none', 'basic', 'standard', 'advanced', 'maximum'];
  return levels.indexOf(actual) >= levels.indexOf(required);
}

/**
 * Get minimum requirements for each level
 */
function getLevelRequirements(level: VerificationLevel): { breadcrumbs: number; trust: number } {
  switch (level) {
    case 'none': return { breadcrumbs: 0, trust: 0 };
    case 'basic': return { breadcrumbs: 10, trust: 0 };
    case 'standard': return { breadcrumbs: 50, trust: 20 };
    case 'advanced': return { breadcrumbs: 100, trust: 50 };
    case 'maximum': return { breadcrumbs: 500, trust: 80 };
  }
}

// ===========================================
// BREADCRUMB CHAIN VERIFICATION
// ===========================================

/**
 * Verify the cryptographic integrity of a user's breadcrumb chain
 * Returns merkle root hash if valid
 */
async function verifyBreadcrumbChain(publicKey: string): Promise<{
  valid: boolean;
  merkleRoot?: string;
  error?: string;
}> {
  try {
    // Get epochs for this user
    const epochs = await db.getEpochs(publicKey);
    
    if (epochs.length === 0) {
      // No epochs yet - chain is trivially valid but empty
      return { valid: true, merkleRoot: undefined };
    }

    // Verify epoch chain integrity
    let prevHash: string | null = null;
    
    for (const epoch of epochs) {
      // Verify epoch links to previous
      if (epoch.prev_epoch_hash !== prevHash) {
        return {
          valid: false,
          error: `Epoch ${epoch.epoch_index} chain break: expected prev=${prevHash}, got ${epoch.prev_epoch_hash}`,
        };
      }
      
      // Verify epoch signature
      const epochData = {
        epoch_index: epoch.epoch_index,
        merkle_root: epoch.merkle_root,
        start_time: epoch.start_time,
        end_time: epoch.end_time,
        block_count: epoch.block_count,
        prev_epoch_hash: epoch.prev_epoch_hash,
      };
      
      const isValidSig = verifySignature(
        publicKey,
        canonicalJson(epochData),
        epoch.signature
      );
      
      if (!isValidSig) {
        return {
          valid: false,
          error: `Epoch ${epoch.epoch_index} has invalid signature`,
        };
      }
      
      prevHash = epoch.epoch_hash;
    }

    // Return the latest merkle root as proof hash
    const latestEpoch = epochs[epochs.length - 1];
    return {
      valid: true,
      merkleRoot: latestEpoch.merkle_root,
    };

  } catch (error) {
    console.error('Chain verification error:', error);
    return {
      valid: false,
      error: 'Internal verification error',
    };
  }
}

// ===========================================
// GET /v1/verify/:identifier
// Core verification endpoint
// ===========================================

router.get('/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    const minLevel = (req.query.min_level as VerificationLevel) || 'basic';
    const includeProof = req.query.include_proof !== 'false';

    console.log(`🔍 Verify request for: ${identifier}`);

    // Resolve identifier to public key
    let publicKey: string;
    let handle: string | null = null;

    if (identifier.startsWith('@') || !identifier.match(/^[a-f0-9]{64}$/i)) {
      // It's a handle
      const normalizedHandle = identifier.toLowerCase().replace(/^@/, '');
      const alias = await db.getAliasByHandle(normalizedHandle);
      
      if (!alias) {
        return res.status(404).json({
          success: false,
          error: 'Handle not found',
          code: 'HANDLE_NOT_FOUND',
        } as ApiResponse);
      }
      
      publicKey = alias.pk_root;
      handle = alias.handle;
    } else {
      // It's a public key
      publicKey = identifier.toLowerCase();
      
      if (!isValidPublicKey(publicKey)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid public key format',
          code: 'INVALID_PUBLIC_KEY',
        } as ApiResponse);
      }
      
      const alias = await db.getAliasByPk(publicKey);
      handle = alias?.handle || null;
    }

    // Get identity record
    const record = await db.getRecord(publicKey);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found',
        code: 'IDENTITY_NOT_FOUND',
      } as ApiResponse);
    }

    // Extract metrics
    const trustScore = record.trust_score || 0;
    const breadcrumbCount = record.breadcrumb_count || 0;

    // Calculate verification level
    const verificationLevel = calculateVerificationLevel(breadcrumbCount, trustScore);
    const verified = meetsMinimumLevel(verificationLevel, minLevel);

    // Verify chain integrity if requested
    let chainValid = true;
    let proofHash: string | undefined;

    if (includeProof) {
      const chainResult = await verifyBreadcrumbChain(publicKey);
      chainValid = chainResult.valid;
      proofHash = chainResult.merkleRoot;
      
      if (!chainResult.valid) {
        console.warn(`⚠️ Chain validation failed for ${publicKey}: ${chainResult.error}`);
      }
    }

    // Calculate trajectory days from first breadcrumb
    let trajectoryDays = 0;
    let verifiedSince: string | undefined;
    
    // Get from alias pot_proof or record metadata
    const alias = await db.getAliasByPk(publicKey);
    if (alias?.pot_proof?.first_breadcrumb_at) {
      const firstBreadcrumb = new Date(alias.pot_proof.first_breadcrumb_at);
      trajectoryDays = Math.floor(
        (Date.now() - firstBreadcrumb.getTime()) / (1000 * 60 * 60 * 24)
      );
      verifiedSince = alias.pot_proof.first_breadcrumb_at;
    }

    // Build response
    const response: ProofOfHumanity = {
      verified,
      public_key: publicKey,
      handle: handle ? `@${handle}` : undefined,
      trust_score: trustScore,
      breadcrumb_count: breadcrumbCount,
      trajectory_days: trajectoryDays,
      proof_hash: proofHash ? `ed25519:${proofHash}` : undefined,
      verified_since: verifiedSince,
      verification_level: verificationLevel,
      chain_valid: chainValid,
      last_activity: record.updated_at,
    };

    console.log(`✅ Verified ${identifier}: level=${verificationLevel}, verified=${verified}`);

    return res.json({
      success: true,
      data: response,
    } as ApiResponse<ProofOfHumanity>);

  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// GET /v1/verify/:identifier/level/:level
// Quick check if identity meets specific level
// ===========================================

router.get('/:identifier/level/:level', async (req: Request, res: Response) => {
  try {
    const { identifier, level } = req.params;
    
    // Validate level parameter
    const validLevels: VerificationLevel[] = ['none', 'basic', 'standard', 'advanced', 'maximum'];
    if (!validLevels.includes(level as VerificationLevel)) {
      return res.status(400).json({
        success: false,
        error: `Invalid level. Must be one of: ${validLevels.join(', ')}`,
        code: 'INVALID_LEVEL',
      } as ApiResponse);
    }

    // Resolve identifier
    let publicKey: string;

    if (identifier.startsWith('@') || !identifier.match(/^[a-f0-9]{64}$/i)) {
      const normalizedHandle = identifier.toLowerCase().replace(/^@/, '');
      const alias = await db.getAliasByHandle(normalizedHandle);
      
      if (!alias) {
        return res.status(404).json({
          success: false,
          error: 'Handle not found',
          code: 'HANDLE_NOT_FOUND',
        } as ApiResponse);
      }
      
      publicKey = alias.pk_root;
    } else {
      publicKey = identifier.toLowerCase();
    }

    // Get record
    const record = await db.getRecord(publicKey);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found',
        code: 'IDENTITY_NOT_FOUND',
      } as ApiResponse);
    }

    // Quick level check
    const actualLevel = calculateVerificationLevel(
      record.breadcrumb_count || 0,
      record.trust_score || 0
    );
    
    const meetsLevel = meetsMinimumLevel(actualLevel, level as VerificationLevel);
    const requirements = getLevelRequirements(level as VerificationLevel);

    return res.json({
      success: true,
      data: {
        meets_level: meetsLevel,
        required_level: level,
        actual_level: actualLevel,
        requirements,
        current: {
          breadcrumbs: record.breadcrumb_count || 0,
          trust_score: record.trust_score || 0,
        },
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Level check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// POST /v1/verify/challenge
// Create interactive verification challenge
// ===========================================

router.post('/challenge', async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateChallengeRequest;
    
    // Validate public key
    if (!body.public_key || !isValidPublicKey(body.public_key)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing public_key',
        code: 'INVALID_PUBLIC_KEY',
      } as ApiResponse);
    }

    const publicKey = body.public_key.toLowerCase();

    // Verify identity exists
    const record = await db.getRecord(publicKey);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Identity not found',
        code: 'IDENTITY_NOT_FOUND',
      } as ApiResponse);
    }

    // Generate challenge
    const challengeId = crypto.randomUUID();
    const challenge = generateNonce();
    const expiresIn = body.expires_in || 300; // Default 5 minutes
    const expiresAt = Date.now() + (expiresIn * 1000);

    // Store challenge
    const storedChallenge: StoredChallenge = {
      challenge_id: challengeId,
      challenge,
      public_key: publicKey,
      require_fresh_breadcrumb: body.require_fresh_breadcrumb || false,
      allowed_h3_cells: body.allowed_h3_cells,
      created_at: Date.now(),
      expires_at: expiresAt,
    };
    
    pendingChallenges.set(challengeId, storedChallenge);

    console.log(`🎲 Created challenge ${challengeId} for ${publicKey.substring(0, 16)}...`);

    const response: VerificationChallenge = {
      challenge_id: challengeId,
      challenge,
      expires_at: new Date(expiresAt).toISOString(),
      required_h3_cells: body.require_fresh_breadcrumb ? body.allowed_h3_cells : undefined,
    };

    return res.status(201).json({
      success: true,
      data: response,
    } as ApiResponse<VerificationChallenge>);

  } catch (error) {
    console.error('Create challenge error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// POST /v1/verify/challenge/:challengeId
// Submit signed challenge for verification
// ===========================================

router.post('/challenge/:challengeId', async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const body = req.body as SubmitChallengeRequest;

    // Validate inputs
    if (!body.public_key || !isValidPublicKey(body.public_key)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing public_key',
        code: 'INVALID_PUBLIC_KEY',
      } as ApiResponse);
    }

    if (!body.signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing signature',
        code: 'MISSING_SIGNATURE',
      } as ApiResponse);
    }

    const publicKey = body.public_key.toLowerCase();

    // Get stored challenge
    const storedChallenge = pendingChallenges.get(challengeId);
    
    if (!storedChallenge) {
      return res.status(404).json({
        success: false,
        error: 'Challenge not found or expired',
        code: 'CHALLENGE_NOT_FOUND',
      } as ApiResponse);
    }

    // Check expiration
    if (Date.now() > storedChallenge.expires_at) {
      pendingChallenges.delete(challengeId);
      return res.status(410).json({
        success: false,
        error: 'Challenge expired',
        code: 'CHALLENGE_EXPIRED',
      } as ApiResponse);
    }

    // Verify public key matches
    if (publicKey !== storedChallenge.public_key) {
      return res.status(403).json({
        success: false,
        error: 'Public key does not match challenge',
        code: 'PUBLIC_KEY_MISMATCH',
      } as ApiResponse);
    }

    // Verify signature
    const signedData = canonicalJson({
      challenge_id: challengeId,
      challenge: storedChallenge.challenge,
      public_key: publicKey,
    });

    const isValid = verifySignature(publicKey, signedData, body.signature);
    
    if (!isValid) {
      console.warn(`❌ Invalid signature for challenge ${challengeId}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE',
      } as ApiResponse);
    }

    // Verify fresh breadcrumb if required
    if (storedChallenge.require_fresh_breadcrumb) {
      if (!body.fresh_breadcrumb) {
        return res.status(400).json({
          success: false,
          error: 'Fresh breadcrumb required but not provided',
          code: 'BREADCRUMB_REQUIRED',
        } as ApiResponse);
      }

      // Verify breadcrumb is recent (within 5 minutes)
      const breadcrumbTime = new Date(body.fresh_breadcrumb.timestamp).getTime();
      if (Date.now() - breadcrumbTime > 5 * 60 * 1000) {
        return res.status(400).json({
          success: false,
          error: 'Breadcrumb is not fresh (must be within 5 minutes)',
          code: 'BREADCRUMB_STALE',
        } as ApiResponse);
      }

      // Verify H3 cell is in allowed list
      if (storedChallenge.allowed_h3_cells && storedChallenge.allowed_h3_cells.length > 0) {
        if (!storedChallenge.allowed_h3_cells.includes(body.fresh_breadcrumb.h3_cell)) {
          return res.status(400).json({
            success: false,
            error: 'Breadcrumb location not in allowed area',
            code: 'BREADCRUMB_LOCATION_INVALID',
          } as ApiResponse);
        }
      }

      // Verify breadcrumb signature
      const breadcrumbData = canonicalJson({
        h3_cell: body.fresh_breadcrumb.h3_cell,
        timestamp: body.fresh_breadcrumb.timestamp,
      });
      
      const breadcrumbValid = verifySignature(
        publicKey,
        breadcrumbData,
        body.fresh_breadcrumb.signature
      );

      if (!breadcrumbValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid breadcrumb signature',
          code: 'INVALID_BREADCRUMB_SIGNATURE',
        } as ApiResponse);
      }
    }

    // Challenge verified! Delete it (one-time use)
    pendingChallenges.delete(challengeId);

    console.log(`✅ Challenge ${challengeId} verified for ${publicKey.substring(0, 16)}...`);

    // Return full proof-of-humanity response
    const record = await db.getRecord(publicKey);
    const alias = await db.getAliasByPk(publicKey);

    const trustScore = record?.trust_score || 0;
    const breadcrumbCount = record?.breadcrumb_count || 0;
    const verificationLevel = calculateVerificationLevel(breadcrumbCount, trustScore);

    // Verify chain
    const chainResult = await verifyBreadcrumbChain(publicKey);

    let trajectoryDays = 0;
    let verifiedSince: string | undefined;
    
    if (alias?.pot_proof?.first_breadcrumb_at) {
      const firstBreadcrumb = new Date(alias.pot_proof.first_breadcrumb_at);
      trajectoryDays = Math.floor(
        (Date.now() - firstBreadcrumb.getTime()) / (1000 * 60 * 60 * 24)
      );
      verifiedSince = alias.pot_proof.first_breadcrumb_at;
    }

    const response: ProofOfHumanity = {
      verified: true, // Challenge was verified
      public_key: publicKey,
      handle: alias?.handle ? `@${alias.handle}` : undefined,
      trust_score: trustScore,
      breadcrumb_count: breadcrumbCount,
      trajectory_days: trajectoryDays,
      proof_hash: chainResult.merkleRoot ? `ed25519:${chainResult.merkleRoot}` : undefined,
      verified_since: verifiedSince,
      verification_level: verificationLevel,
      chain_valid: chainResult.valid,
      last_activity: record?.updated_at,
    };

    return res.json({
      success: true,
      data: response,
    } as ApiResponse<ProofOfHumanity>);

  } catch (error) {
    console.error('Submit challenge error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

// ===========================================
// GET /v1/verify/batch
// Batch verify multiple identities
// ===========================================

router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { identifiers, min_level = 'basic' } = req.body;

    if (!Array.isArray(identifiers) || identifiers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'identifiers must be a non-empty array',
        code: 'INVALID_INPUT',
      } as ApiResponse);
    }

    if (identifiers.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 identifiers per batch',
        code: 'TOO_MANY_IDENTIFIERS',
      } as ApiResponse);
    }

    const results: Array<{
      identifier: string;
      verified: boolean;
      verification_level: VerificationLevel;
      error?: string;
    }> = [];

    for (const identifier of identifiers) {
      try {
        // Resolve identifier
        let publicKey: string;

        if (identifier.startsWith('@') || !identifier.match(/^[a-f0-9]{64}$/i)) {
          const normalizedHandle = identifier.toLowerCase().replace(/^@/, '');
          const alias = await db.getAliasByHandle(normalizedHandle);
          
          if (!alias) {
            results.push({
              identifier,
              verified: false,
              verification_level: 'none',
              error: 'Handle not found',
            });
            continue;
          }
          
          publicKey = alias.pk_root;
        } else {
          publicKey = identifier.toLowerCase();
        }

        // Get record
        const record = await db.getRecord(publicKey);
        
        if (!record) {
          results.push({
            identifier,
            verified: false,
            verification_level: 'none',
            error: 'Identity not found',
          });
          continue;
        }

        // Calculate level
        const level = calculateVerificationLevel(
          record.breadcrumb_count || 0,
          record.trust_score || 0
        );

        const verified = meetsMinimumLevel(level, min_level as VerificationLevel);

        results.push({
          identifier,
          verified,
          verification_level: level,
        });

      } catch (error) {
        results.push({
          identifier,
          verified: false,
          verification_level: 'none',
          error: 'Verification failed',
        });
      }
    }

    return res.json({
      success: true,
      data: {
        results,
        min_level,
        verified_count: results.filter(r => r.verified).length,
        total_count: results.length,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Batch verify error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    } as ApiResponse);
  }
});

export default router;

// ===========================================
// EXPORTS FOR USE IN OTHER MODULES
// ===========================================

export {
  calculateVerificationLevel,
  meetsMinimumLevel,
  getLevelRequirements,
  verifyBreadcrumbChain,
};
