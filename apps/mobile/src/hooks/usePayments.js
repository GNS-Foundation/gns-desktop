/**
 * Hook for payment/transaction functionality
 * TODO: Integrate with Supabase API
 */
export function usePayments() {
    // Placeholder - will integrate with existing Supabase payment API
    return {
        dailyStats: { sent: 0, received: 0 },
        pendingCount: 0,
        transactions: [],
    };
}
