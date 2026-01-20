import { useState, useEffect } from 'react';

export function useSubscriptions() {
    const [loading, setLoading] = useState(true);
    const [subscriptions, setSubscriptions] = useState([]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setSubscriptions([
                {
                    id: '1',
                    planName: 'Pro Plan',
                    merchantName: 'GNS Cloud',
                    amount: 9.99,
                    status: 'active', // active, paused, cancelled, past_due
                    billingCycle: 'Monthly',
                    nextBillingDate: '2025-06-01',
                    startDate: '2024-01-01',
                    autoRenew: true,
                    daysUntilRenewal: 12
                },
                {
                    id: '2',
                    planName: 'Premium Music',
                    merchantName: 'SoundWave',
                    amount: 14.99,
                    status: 'active',
                    billingCycle: 'Monthly',
                    nextBillingDate: '2025-05-28',
                    startDate: '2023-05-28',
                    autoRenew: true,
                    daysUntilRenewal: 8
                },
                {
                    id: '3',
                    planName: 'News Bundle',
                    merchantName: 'Daily Post',
                    amount: 4.99,
                    status: 'paused',
                    billingCycle: 'Monthly',
                    nextBillingDate: null,
                    startDate: '2024-02-15',
                    autoRenew: false
                },
                {
                    id: '4',
                    planName: 'Video Streaming',
                    merchantName: 'StreamFlix',
                    amount: 12.99,
                    status: 'cancelled',
                    billingCycle: 'Monthly',
                    nextBillingDate: null,
                    startDate: '2023-01-10',
                    autoRenew: false
                }
            ]);
            setLoading(false);
        }, 600);
        return () => clearTimeout(timer);
    }, []);

    const toggleStatus = async (id, currentStatus) => {
        // Mock toggle
        setSubscriptions(prev => prev.map(sub => {
            if (sub.id === id) {
                if (currentStatus === 'active') return { ...sub, status: 'paused', nextBillingDate: null };
                if (currentStatus === 'paused') return { ...sub, status: 'active', nextBillingDate: '2025-06-15' }; // Mock date
            }
            return sub;
        }));
        return { success: true };
    };

    const cancelSubscription = async (id) => {
        setSubscriptions(prev => prev.map(sub => {
            if (sub.id === id) return { ...sub, status: 'cancelled', nextBillingDate: null, autoRenew: false };
            return sub;
        }));
        return { success: true };
    };

    return {
        loading,
        subscriptions,
        toggleStatus,
        cancelSubscription
    };
}
