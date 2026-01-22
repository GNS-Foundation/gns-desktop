import { useState, useCallback, useEffect } from 'react';
import { useIdentity } from './useIdentity';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function usePaymentLinks() {
    const { identity } = useIdentity();
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const getHeaders = useCallback(() => {
        if (!identity || !identity.publicKey) return {};
        return {
            'Content-Type': 'application/json',
            'X-GNS-PublicKey': identity.publicKey,
            'X-GNS-Identity': identity.publicKey // Fallback
        };
    }, [identity]);

    const fetchLinks = useCallback(async () => {
        if (!identity?.publicKey) return;

        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/api/link/list`, {
                headers: getHeaders()
            });
            const data = await res.json();

            if (data.success) {
                setLinks(data.links);
                setError(null);
            } else {
                setError(data.error || 'Failed to fetch links');
            }
        } catch (e) {
            console.error('Fetch links error:', e);
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    }, [identity, getHeaders]);

    const createLink = async (linkData) => {
        if (!identity?.publicKey) {
            throw new Error("No identity found");
        }

        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/api/link/create`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(linkData)
            });
            const data = await res.json();

            if (data.success) {
                await fetchLinks(); // Refresh list
                return data.link;
            } else {
                throw new Error(data.error || 'Failed to create link');
            }
        } catch (e) {
            console.error('Create link error:', e);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const deactivateLink = async (linkId) => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/api/link/${linkId}/deactivate`, {
                method: 'PUT',
                headers: getHeaders()
            });
            const data = await res.json();

            if (data.success) {
                // Optimistic update
                setLinks(prev => prev.map(link =>
                    link.id === linkId ? { ...link, status: 'inactive' } : link
                ));
            } else {
                throw new Error(data.error || 'Failed to deactivate link');
            }
        } catch (e) {
            console.error('Deactivate link error:', e);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (identity?.publicKey) {
            fetchLinks();
        }
    }, [identity, fetchLinks]);

    return {
        links,
        loading,
        error,
        fetchLinks,
        createLink,
        deactivateLink
    };
}
