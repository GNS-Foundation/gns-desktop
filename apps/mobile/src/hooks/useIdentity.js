import { useState, useEffect } from 'react';
import { createIdentity, getIdentity, listIdentities } from 'tauri-plugin-gns-api';

/**
 * Hook for GNS identity management
 */
export function useIdentity() {
    const [identity, setIdentity] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadIdentity();
    }, []);

    async function loadIdentity() {
        try {
            setLoading(true);
            const result = await getIdentity();
            setIdentity(result);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function create(name) {
        console.log('[useIdentity] Creating identity with name:', name);
        try {
            const newIdentity = await createIdentity({ name, setAsDefault: true });
            console.log('[useIdentity] Creation successful:', newIdentity);
            setIdentity(newIdentity);
            return newIdentity;
        } catch (err) {
            console.error('[useIdentity] Creation failed:', err);
            // Handle Tauri string errors vs Error objects
            const message = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
            setError(message);
            throw new Error(message);
        }
    }

    return {
        identity,
        loading,
        error,
        create,
        reload: loadIdentity,
    };
}
