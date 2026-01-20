import { useState, useEffect } from 'react';

export function useLoyalty() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [rewards, setRewards] = useState([]);
    const [achievements, setAchievements] = useState([]);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        // Mock API call
        const timer = setTimeout(() => {
            setProfile({
                availablePoints: 2450,
                lifetimePoints: 5200,
                totalTransactions: 42,
                tier: {
                    id: 'silver',
                    displayName: 'Silver',
                    emoji: '🥈'
                },
                nextTier: {
                    id: 'gold',
                    displayName: 'Gold'
                },
                pointsToNextTier: 550,
                tierProgressPercent: 78
            });

            setRewards([
                { id: '1', name: '$5 Off Next Order', description: 'Get $5 off your next purchase at participating merchants.', pointsCost: 500, type: 'discount' },
                { id: '2', name: 'Free Coffee', description: 'Redeem for a standard coffee at any GNS Cafe.', pointsCost: 300, type: 'gift' },
                { id: '3', name: '10 GNS Token', description: 'Convert points directly to GNS tokens.', pointsCost: 1000, type: 'token' },
                { id: '4', name: 'Premium Theme', description: 'Unlock the exclusive "Dark Matter" theme.', pointsCost: 2000, type: 'digital' },
            ]);

            setAchievements([
                { id: '1', name: 'First Steps', description: 'Complete your first transaction.', icon: '🚀', isUnlocked: true, progress: 100 },
                { id: '2', name: 'Big Spender', description: 'Spend over $1000 in a month.', icon: '💸', isUnlocked: true, progress: 100 },
                { id: '3', name: 'Loyal Customer', description: 'Visit the same merchant 10 times.', icon: '🏪', isUnlocked: false, progress: 40, target: 10 },
                { id: '4', name: 'Global Citizen', description: 'Send a payment to another country.', icon: '🌍', isUnlocked: false, progress: 0, target: 1 },
            ]);

            setHistory([
                { id: '1', description: 'Purchase at Starbucks', points: 12, isCredit: true, date: '2025-05-20' },
                { id: '2', description: 'Purchase at Uber', points: 8, isCredit: true, date: '2025-05-19' },
                { id: '3', description: 'Redeemed Free Coffee', points: 300, isCredit: false, date: '2025-05-15' },
                { id: '4', description: 'Weekly Bonus', points: 50, isCredit: true, date: '2025-05-14' },
                { id: '5', description: 'Purchase at Amazon', points: 45, isCredit: true, date: '2025-05-12' },
            ]);

            setLoading(false);
        }, 800);

        return () => clearTimeout(timer);
    }, []);

    const redeemReward = async (rewardId) => {
        // Mock redemption
        return new Promise((resolve) => {
            setTimeout(() => {
                setProfile(prev => ({
                    ...prev,
                    availablePoints: prev.availablePoints - rewards.find(r => r.id === rewardId).pointsCost
                }));
                // Add redemption to history
                const reward = rewards.find(r => r.id === rewardId);
                setHistory(prev => [{
                    id: Date.now().toString(),
                    description: `Redeemed ${reward.name}`,
                    points: reward.pointsCost,
                    isCredit: false,
                    date: new Date().toISOString().split('T')[0]
                }, ...prev]);

                resolve({ success: true });
            }, 500);
        });
    };

    return {
        loading,
        profile,
        rewards,
        achievements,
        history,
        redeemReward
    };
}
