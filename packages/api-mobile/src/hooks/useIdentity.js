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
        try {
            const newIdentity = await createIdentity({ name, setAsDefault: true });
            setIdentity(newIdentity);
            return newIdentity;
        } catch (err) {
            setError(err.message);
            throw err;
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
