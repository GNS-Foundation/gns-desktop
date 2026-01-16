import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Hook for breadcrumb collection management
 */
export function useBreadcrumbs() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStatus();
    }, []);

    async function loadStatus() {
        try {
            setLoading(true);
            const result = await invoke('get_breadcrumb_status');
            setStatus(result);
        } catch (err) {
            console.error('Failed to load breadcrumb status:', err);
        } finally {
            setLoading(false);
        }
    }

    async function start() {
        await invoke('set_collection_enabled', { enabled: true });
        await loadStatus();
    }

    async function stop() {
        await invoke('set_collection_enabled', { enabled: false });
        await loadStatus();
    }

    async function drop() {
        const result = await invoke('drop_breadcrumb');
        await loadStatus();
        return result;
    }

    return {
        status,
        loading,
        start,
        stop,
        drop,
        reload: loadStatus,
    };
}
