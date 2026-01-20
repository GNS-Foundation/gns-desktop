import { useState, useEffect, useMemo } from 'react';
import { useStellar } from './useStellar';

export function useAnalytics() {
    const { history, loadHistory, loading: stellarLoading } = useStellar();
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('month'); // 'week', 'month', 'year'

    useEffect(() => {
        // Load enough history for analytics
        loadHistory(100).then(() => setLoading(false));
    }, [loadHistory]);

    const analyticsData = useMemo(() => {
        if (!history || history.length === 0) return null;

        const now = new Date();
        const startOfPeriod = new Date();
        if (period === 'week') startOfPeriod.setDate(now.getDate() - 7);
        if (period === 'month') startOfPeriod.setMonth(now.getMonth() - 1);
        if (period === 'year') startOfPeriod.setFullYear(now.getFullYear() - 1);

        const filteredTx = history.filter(tx => new Date(tx.created_at) >= startOfPeriod);

        // 1. Summary
        let totalSpent = 0;
        let totalReceived = 0;
        let totalTx = filteredTx.length;

        // 2. Daily Spending for Chart
        const dailyMap = {};

        // 3. Categories (Mocked based on memo or random for now, since we lack category metadata)
        const categoryMap = {};

        filteredTx.forEach(tx => {
            const amount = parseFloat(tx.amount);
            const dateStr = new Date(tx.created_at).toLocaleDateString();

            if (!tx.is_received) {
                // Spending
                totalSpent += amount;

                // Chart Data
                dailyMap[dateStr] = (dailyMap[dateStr] || 0) + amount;

                // Category Logic (Simple heuristic)
                let category = 'Uncategorized';
                if (tx.memo) {
                    if (tx.memo.toLowerCase().includes('food')) category = 'Food';
                    else if (tx.memo.toLowerCase().includes('uber') || tx.memo.toLowerCase().includes('transport')) category = 'Transport';
                    else if (tx.memo.toLowerCase().includes('shop')) category = 'Shopping';
                }

                categoryMap[category] = (categoryMap[category] || 0) + amount;
            } else {
                // Income
                totalReceived += amount;
            }
        });

        // Format Daily Data
        const dailyData = Object.keys(dailyMap).map(date => ({
            date,
            amount: dailyMap[date]
        })).sort((a, b) => new Date(a.date) - new Date(b.date));

        // Format Category Data
        const categories = Object.keys(categoryMap).map(name => ({
            name,
            value: categoryMap[name],
            color: getCategoryColor(name)
        })).sort((a, b) => b.value - a.value);

        return {
            summary: {
                totalSpent,
                totalReceived,
                netFlow: totalReceived - totalSpent,
                totalTx
            },
            dailyData,
            categories,
            // Mock Budgets & Goals
            budgets: [
                { id: 1, name: 'Groceries', limit: 500, spent: 320, color: '#2ecc71' },
                { id: 2, name: 'Entertainment', limit: 200, spent: 250, color: '#e74c3c' }, // Over budget
                { id: 3, name: 'Transport', limit: 150, spent: 45, color: '#3498db' },
            ],
            goals: [
                { id: 1, name: 'New Laptop', target: 2000, current: 1500, emoji: '💻' },
                { id: 2, name: 'Vacation', target: 5000, current: 1200, emoji: '🏖️' },
            ]
        };
    }, [history, period]);

    return {
        loading: loading || stellarLoading,
        data: analyticsData,
        period,
        setPeriod
    };
}

function getCategoryColor(name) {
    const colors = {
        'Food': '#f1c40f',
        'Transport': '#3498db',
        'Shopping': '#9b59b6',
        'Uncategorized': '#95a5a6'
    };
    return colors[name] || '#95a5a6';
}
