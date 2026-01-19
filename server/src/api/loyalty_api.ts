// ===========================================
// GNS NODE - LOYALTY API (Sprint 6)
// /loyalty endpoints for points & rewards
//
// Location: src/api/loyalty.ts
//
// ENDPOINTS:
//   GET  /loyalty/profile           - Get user's loyalty profile
//   GET  /loyalty/points/history    - Get points transaction history
//   GET  /loyalty/rewards           - Get available rewards
//   POST /loyalty/rewards/:id/redeem - Redeem a reward
//   GET  /loyalty/rewards/redeemed  - Get user's redeemed rewards
//   GET  /loyalty/achievements      - Get achievements
//   GET  /loyalty/programs          - Get merchant programs
//   POST /loyalty/programs/:id/enroll - Enroll in program
//   GET  /loyalty/referral/code     - Get user's referral code
//   POST /loyalty/referral/submit   - Submit referral code
//
// POINTS EARNING:
//   - Base: 1 point per $1 spent
//   - Tier bonus: Silver 1.25x, Gold 1.5x, Platinum 2x, Diamond 3x
//   - Merchant bonus: Additional multipliers for partner merchants
// ===========================================

import { Router, Request, Response } from 'express';
import { isValidPublicKey } from '../lib/crypto';
import * as db from '../lib/db';
import { ApiResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ===========================================
// TYPES
// ===========================================

interface UserRequest extends Request {
  gnsPublicKey?: string;
}

type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

type PointTransactionType = 'earned' | 'redeemed' | 'expired' | 'bonus' | 'referral' | 'adjustment';

interface TierConfig {
  threshold: number;
  multiplier: number;
  benefits: string[];
}

// Tier configuration
const TIER_CONFIG: Record<LoyaltyTier, TierConfig> = {
  bronze: {
    threshold: 0,
    multiplier: 1.0,
    benefits: ['1 point per $1 spent', 'Basic rewards access'],
  },
  silver: {
    threshold: 1000,
    multiplier: 1.25,
    benefits: ['1.25x points multiplier', 'Early access to rewards', 'Birthday bonus'],
  },
  gold: {
    threshold: 5000,
    multiplier: 1.5,
    benefits: ['1.5x points multiplier', 'Exclusive rewards', 'Priority support'],
  },
  platinum: {
    threshold: 15000,
    multiplier: 2.0,
    benefits: ['2x points multiplier', 'VIP rewards', 'Free premium features'],
  },
  diamond: {
    threshold: 50000,
    multiplier: 3.0,
    benefits: ['3x points multiplier', 'Concierge service', 'Exclusive events access'],
  },
};

// ===========================================
// AUTH MIDDLEWARE
// ===========================================

const verifyUserAuth = async (
  req: UserRequest,
  res: Response,
  next: Function
) => {
  try {
    const publicKey = req.headers['x-gns-public-key'] as string;

    if (!publicKey) {
      return res.status(401).json({
        success: false,
        error: 'Missing X-GNS-Public-Key header',
      } as ApiResponse);
    }

    if (!isValidPublicKey(publicKey)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid public key format',
      } as ApiResponse);
    }

    req.gnsPublicKey = publicKey.toLowerCase();
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function calculateTier(lifetimePoints: number): LoyaltyTier {
  const tiers: LoyaltyTier[] = ['diamond', 'platinum', 'gold', 'silver', 'bronze'];
  for (const tier of tiers) {
    if (lifetimePoints >= TIER_CONFIG[tier].threshold) {
      return tier;
    }
  }
  return 'bronze';
}

function getNextTier(currentTier: LoyaltyTier): LoyaltyTier | null {
  const tiers: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const currentIndex = tiers.indexOf(currentTier);
  if (currentIndex < tiers.length - 1) {
    return tiers[currentIndex + 1];
  }
  return null;
}

function generateReferralCode(userPk: string): string {
  // Generate a 8-character referral code from public key
  const hash = userPk.substring(0, 8).toUpperCase();
  return `GNS-${hash}`;
}

// ===========================================
// GET /loyalty/profile
// Get user's loyalty profile
// ===========================================

router.get('/profile', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;

    // Get or create loyalty profile
    let profile = await db.getLoyaltyProfile(userPk);
    
    if (!profile) {
      // Create new profile
      profile = await db.createLoyaltyProfile({
        user_pk: userPk,
        total_points: 0,
        available_points: 0,
        lifetime_points: 0,
        tier: 'bronze',
        tier_progress: 0,
        total_transactions: 0,
        total_spent: 0,
      });
    }

    // Calculate current tier
    const tier = calculateTier(profile.lifetime_points);
    const nextTier = getNextTier(tier);
    const tierThreshold = nextTier ? TIER_CONFIG[nextTier].threshold : TIER_CONFIG[tier].threshold;
    const tierProgress = profile.lifetime_points - TIER_CONFIG[tier].threshold;

    // Get recent achievements
    const achievements = await db.getUserAchievements(userPk, { limit: 5 });

    const profileData = {
      user_public_key: userPk,
      total_points: profile.total_points,
      available_points: profile.available_points,
      lifetime_points: profile.lifetime_points,
      tier,
      tier_progress: tierProgress,
      tier_threshold: tierThreshold,
      tier_benefits: TIER_CONFIG[tier].benefits,
      multiplier: TIER_CONFIG[tier].multiplier,
      total_transactions: profile.total_transactions,
      total_spent: profile.total_spent,
      achievements,
      member_since: profile.created_at,
      last_activity: profile.updated_at,
    };

    return res.json({
      success: true,
      data: profileData,
    } as ApiResponse);

  } catch (error) {
    console.error('GET /loyalty/profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /loyalty/points/history
// Get points transaction history
// ===========================================

router.get('/points/history', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { type, limit = '50', offset = '0' } = req.query;

    const transactions = await db.getPointsHistory(userPk, {
      type: type as PointTransactionType | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    return res.json({
      success: true,
      data: transactions,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: transactions.length,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('GET /loyalty/points/history error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// POST /loyalty/points/award
// Award points to user (internal/admin use)
// ===========================================

router.post('/points/award', async (req: Request, res: Response) => {
  try {
    const { user_pk, points, type, description, reference_id, merchant_id } = req.body;

    if (!user_pk || !points || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_pk, points, type',
      } as ApiResponse);
    }

    // Get current balance
    const profile = await db.getLoyaltyProfile(user_pk);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found',
      } as ApiResponse);
    }

    // Create transaction
    const transaction = await db.createPointTransaction({
      transaction_id: `PT-${uuidv4().substring(0, 8).toUpperCase()}`,
      user_pk: user_pk.toLowerCase(),
      points,
      type,
      description: description || `Points ${type}`,
      reference_id,
      merchant_id,
      balance_after: profile.available_points + points,
    });

    // Update profile
    await db.updateLoyaltyProfile(user_pk, {
      total_points: profile.total_points + points,
      available_points: profile.available_points + points,
      lifetime_points: type === 'earned' || type === 'bonus' || type === 'referral'
        ? profile.lifetime_points + points
        : profile.lifetime_points,
    });

    console.log(`🎯 Points awarded: ${points} to ${user_pk.substring(0, 8)}...`);

    return res.json({
      success: true,
      data: transaction,
      message: `${points} points awarded`,
    } as ApiResponse);

  } catch (error) {
    console.error('POST /loyalty/points/award error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /loyalty/rewards
// Get available rewards
// ===========================================

router.get('/rewards', async (req: Request, res: Response) => {
  try {
    const { merchant_id, category, max_points, limit = '50' } = req.query;

    const rewards = await db.getAvailableRewards({
      merchantId: merchant_id as string | undefined,
      category: category as string | undefined,
      maxPoints: max_points ? parseInt(max_points as string) : undefined,
      limit: parseInt(limit as string),
    });

    return res.json({
      success: true,
      data: rewards,
    } as ApiResponse);

  } catch (error) {
    console.error('GET /loyalty/rewards error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// POST /loyalty/rewards/:id/redeem
// Redeem a reward
// ===========================================

router.post('/rewards/:id/redeem', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userPk = req.gnsPublicKey!;

    // Get reward
    const reward = await db.getReward(id);
    if (!reward) {
      return res.status(404).json({
        success: false,
        error: 'Reward not found',
      } as ApiResponse);
    }

    // Check availability
    if (!reward.is_available) {
      return res.status(400).json({
        success: false,
        error: 'Reward is not available',
      } as ApiResponse);
    }

    // Check expiration
    if (reward.expires_at && new Date(reward.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Reward has expired',
      } as ApiResponse);
    }

    // Check quantity
    if (reward.quantity_available !== null && reward.quantity_available <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Reward is out of stock',
      } as ApiResponse);
    }

    // Get user profile
    const profile = await db.getLoyaltyProfile(userPk);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found',
      } as ApiResponse);
    }

    // Check points balance
    if (profile.available_points < reward.points_cost) {
      return res.status(400).json({
        success: false,
        error: `Insufficient points. Need ${reward.points_cost}, have ${profile.available_points}`,
      } as ApiResponse);
    }

    // Generate coupon code if applicable
    const couponCode = reward.type === 'discount' || reward.type === 'free_item'
      ? `${id.substring(0, 4)}-${uuidv4().substring(0, 4)}`.toUpperCase()
      : null;

    // Create redemption
    const redemption = await db.createRedemption({
      redemption_id: `RDM-${uuidv4().substring(0, 8).toUpperCase()}`,
      reward_id: id,
      reward_name: reward.name,
      user_pk: userPk,
      points_spent: reward.points_cost,
      coupon_code: couponCode,
      expires_at: reward.expires_at,
      merchant_id: reward.merchant_id,
    });

    // Deduct points
    await db.updateLoyaltyProfile(userPk, {
      available_points: profile.available_points - reward.points_cost,
    });

    // Create point transaction
    await db.createPointTransaction({
      transaction_id: `PT-${uuidv4().substring(0, 8).toUpperCase()}`,
      user_pk: userPk,
      points: -reward.points_cost,
      type: 'redeemed',
      description: `Redeemed: ${reward.name}`,
      reference_id: redemption.redemption_id,
      merchant_id: reward.merchant_id,
      balance_after: profile.available_points - reward.points_cost,
    });

    // Update reward quantity
    if (reward.quantity_available !== null) {
      await db.updateReward(id, {
        quantity_available: reward.quantity_available - 1,
      });
    }

    console.log(`🎁 Reward redeemed: ${reward.name} by ${userPk.substring(0, 8)}...`);

    return res.json({
      success: true,
      data: redemption,
      message: 'Reward redeemed successfully',
    } as ApiResponse);

  } catch (error) {
    console.error('POST /loyalty/rewards/:id/redeem error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /loyalty/rewards/redeemed
// Get user's redeemed rewards
// ===========================================

router.get('/rewards/redeemed', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { unused, limit = '50' } = req.query;

    const redemptions = await db.getUserRedemptions(userPk, {
      unused: unused === 'true',
      limit: parseInt(limit as string),
    });

    return res.json({
      success: true,
      data: redemptions,
    } as ApiResponse);

  } catch (error) {
    console.error('GET /loyalty/rewards/redeemed error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /loyalty/achievements
// Get all achievements with user progress
// ===========================================

router.get('/achievements', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { unlocked } = req.query;

    const achievements = await db.getUserAchievements(userPk, {
      unlocked: unlocked === 'true' ? true : unlocked === 'false' ? false : undefined,
    });

    return res.json({
      success: true,
      data: achievements,
    } as ApiResponse);

  } catch (error) {
    console.error('GET /loyalty/achievements error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /loyalty/programs
// Get merchant loyalty programs
// ===========================================

router.get('/programs', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { enrolled } = req.query;

    const programs = await db.getLoyaltyPrograms({
      userPk,
      enrolled: enrolled === 'true' ? true : enrolled === 'false' ? false : undefined,
    });

    return res.json({
      success: true,
      data: programs,
    } as ApiResponse);

  } catch (error) {
    console.error('GET /loyalty/programs error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// POST /loyalty/programs/:id/enroll
// Enroll in merchant loyalty program
// ===========================================

router.post('/programs/:id/enroll', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userPk = req.gnsPublicKey!;

    // Get program
    const program = await db.getLoyaltyProgram(id);
    if (!program) {
      return res.status(404).json({
        success: false,
        error: 'Program not found',
      } as ApiResponse);
    }

    // Check if already enrolled
    const existing = await db.getUserProgramEnrollment(userPk, id);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Already enrolled in this program',
      } as ApiResponse);
    }

    // Create enrollment
    await db.createProgramEnrollment({
      user_pk: userPk,
      program_id: id,
      merchant_id: program.merchant_id,
    });

    console.log(`📋 Enrolled in program: ${program.program_name}`);

    return res.json({
      success: true,
      message: `Enrolled in ${program.program_name}`,
    } as ApiResponse);

  } catch (error) {
    console.error('POST /loyalty/programs/:id/enroll error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /loyalty/referral/code
// Get user's referral code
// ===========================================

router.get('/referral/code', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;

    const code = generateReferralCode(userPk);

    return res.json({
      success: true,
      data: {
        code,
        points_per_referral: 100,
        share_url: `https://gns.network/join?ref=${code}`,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('GET /loyalty/referral/code error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// POST /loyalty/referral/submit
// Submit referral code
// ===========================================

router.post('/referral/submit', verifyUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const userPk = req.gnsPublicKey!;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Missing referral code',
      } as ApiResponse);
    }

    // Check if user already used a referral
    const profile = await db.getLoyaltyProfile(userPk);
    if (profile?.referred_by) {
      return res.status(400).json({
        success: false,
        error: 'You have already used a referral code',
      } as ApiResponse);
    }

    // Find referrer by code
    const referrer = await db.findUserByReferralCode(code);
    if (!referrer) {
      return res.status(400).json({
        success: false,
        error: 'Invalid referral code',
      } as ApiResponse);
    }

    // Can't refer yourself
    if (referrer.user_pk.toLowerCase() === userPk) {
      return res.status(400).json({
        success: false,
        error: 'Cannot use your own referral code',
      } as ApiResponse);
    }

    // Award points to both
    const pointsAwarded = 100;

    // Award to new user
    await db.updateLoyaltyProfile(userPk, {
      available_points: (profile?.available_points || 0) + pointsAwarded,
      total_points: (profile?.total_points || 0) + pointsAwarded,
      lifetime_points: (profile?.lifetime_points || 0) + pointsAwarded,
      referred_by: referrer.user_pk,
    });

    await db.createPointTransaction({
      transaction_id: `PT-${uuidv4().substring(0, 8).toUpperCase()}`,
      user_pk: userPk,
      points: pointsAwarded,
      type: 'referral',
      description: 'Referral bonus',
      balance_after: (profile?.available_points || 0) + pointsAwarded,
    });

    // Award to referrer
    const referrerProfile = await db.getLoyaltyProfile(referrer.user_pk);
    if (referrerProfile) {
      await db.updateLoyaltyProfile(referrer.user_pk, {
        available_points: referrerProfile.available_points + pointsAwarded,
        total_points: referrerProfile.total_points + pointsAwarded,
        lifetime_points: referrerProfile.lifetime_points + pointsAwarded,
      });

      await db.createPointTransaction({
        transaction_id: `PT-${uuidv4().substring(0, 8).toUpperCase()}`,
        user_pk: referrer.user_pk,
        points: pointsAwarded,
        type: 'referral',
        description: `Referral: new user joined`,
        balance_after: referrerProfile.available_points + pointsAwarded,
      });
    }

    console.log(`🤝 Referral completed: ${pointsAwarded} points each`);

    return res.json({
      success: true,
      data: {
        points_earned: pointsAwarded,
      },
      message: `Welcome bonus: ${pointsAwarded} points earned!`,
    } as ApiResponse);

  } catch (error) {
    console.error('POST /loyalty/referral/submit error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ===========================================
// GET /loyalty/tiers
// Get tier information
// ===========================================

router.get('/tiers', async (req: Request, res: Response) => {
  try {
    const tiers = Object.entries(TIER_CONFIG).map(([name, config]) => ({
      name,
      ...config,
    }));

    return res.json({
      success: true,
      data: tiers,
    } as ApiResponse);

  } catch (error) {
    console.error('GET /loyalty/tiers error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

export default router;
