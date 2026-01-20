import { useState, useEffect } from 'react';
import { createIdentity, getIdentity, listIdentities } from 'tauri-plugin-gns-api';
import { invoke } from '@tauri-apps/api/core';

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
            // 1. Get base identity (keys, basic info)
            const result = await getIdentity();

            if (result) {
                try {
                    // 2. Get profile data (name, bio, avatar)
                    const profile = await invoke('get_profile');
                    if (profile) {
                        // Merge profile data into identity object
                        Object.assign(result, {
                            displayName: profile.display_name,
                            bio: profile.bio,
                            avatarUrl: profile.avatar_url,
                            links: profile.links,
                            locationPublic: profile.location_public,
                            locationResolution: profile.location_resolution
                        });
                    }

                    // 3. Get handle info (status, breadcrumbs)
                    try {
                        const infoResult = await invoke('get_identity_info');
                        if (infoResult && infoResult.success && infoResult.data) {
                            const data = infoResult.data;
                            // Parse handle status
                            // HandleStatus is complex enum in Rust, becomes object in JS
                            // { Reserved: { handle: "...", ... } } or { None: null } or { Claimed: ... }

                            const status = data.handle_status;
                            let reservedHandle = null;
                            let claimedHandle = null;

                            if (status && typeof status === 'object') {
                                if (status.Reserved) {
                                    reservedHandle = status.Reserved.handle;
                                } else if (status.Claimed) {
                                    claimedHandle = status.Claimed.handle;
                                }
                            }

                            Object.assign(result, {
                                encryptionKey: data.encryption_key,
                                gnsId: data.gns_id,
                                reservedHandle,
                                claimedHandle,
                                // TODO: Get breadcrumb count from separate call or include in identity info
                            });
                        }
                    } catch (e) {
                        console.warn('Failed to load handle info:', e);
                    }
                } catch (e) {
                    console.warn('Failed to load profile data:', e);
                }
            }

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

            // Also initialize profile with name
            try {
                await invoke('update_profile', {
                    profileData: {
                        display_name: name,
                        bio: null,
                        avatar_url: null,
                        links: [],
                        location_public: false,
                        location_resolution: 7
                    }
                });
            } catch (e) {
                console.warn('Failed to initialize profile:', e);
            }

            console.log('[useIdentity] Creation successful:', newIdentity);
            // Reload to get full object
            await loadIdentity();
            return newIdentity;
        } catch (err) {
            console.error('[useIdentity] Creation failed:', err);
            // Handle Tauri string errors vs Error objects
            const message = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
            setError(message);
            throw new Error(message);
        }
    }

    async function updateProfile(data) {
        try {
            await invoke('update_profile', {
                profileData: {
                    display_name: data.displayName || null,
                    bio: data.bio || null,
                    avatar_url: data.avatarUrl || null,
                    links: data.links || [],
                    location_public: !!data.locationPublic,
                    location_resolution: data.locationResolution || 7
                }
            });
            await loadIdentity(); // Reload to update state
            return { success: true };
        } catch (err) {
            console.error('Update profile failed:', err);
            return { success: false, error: err.toString() };
        }
    }

    return {
        identity,
        loading,
        error,
        create,
        updateProfile,
        reload: loadIdentity,
    };
}
