import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useStellar() {
    const [balances, setBalances] = useState({
        stellar_address: '',
        xlm_balance: 0,
        gns_balance: 0,
        account_exists: false,
        use_testnet: false,
        claimable_gns: []
    });
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadBalances = useCallback(async () => {
        try {
            setLoading(true);
            const res = await invoke('get_stellar_balances');
            setBalances(res);
            setError(null);
        } catch (e) {
            console.error('Failed to load balances:', e);
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    }, []);

    const loadHistory = useCallback(async (limit = 20) => {
        try {
            setLoading(true);
            const res = await invoke('get_payment_history', { limit });
            setHistory(res);
        } catch (e) {
            console.error('Failed to load history:', e);
            // setError(e.toString()); // Don't block UI on history fail
        } finally {
            setLoading(false);
        }
    }, []);

    const sendGns = async (recipientHandle, amount, memo) => {
        try {
            setLoading(true);
            const res = await invoke('send_gns', {
                request: {
                    recipient_handle: recipientHandle.startsWith('@') ? recipientHandle.substring(1) : recipientHandle,
                    amount: parseFloat(amount),
                    memo: memo
                }
            });

            if (!res.success) {
                throw new Error(res.error || "Transaction failed");
            }

            // Refresh balances/history on success
            await Promise.all([loadBalances(), loadHistory()]);
            return res.hash;
        } catch (e) {
            throw e;
        } finally {
            setLoading(false);
        }
    };

    return {
        balances,
        history,
        loading,
        error,
        loadBalances,
        loadHistory,
        sendGns
    };
}
