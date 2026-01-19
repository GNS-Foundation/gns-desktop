// apps/mobile/src/services/OrgService.js

import { useState, useEffect, useCallback } from 'react';
import { checkOrgAvailability, registerOrg, verifyOrgDns, activateOrg, GNS_API_BASE } from '@gns/api-web';

const STORAGE_KEY = 'gns_org_registrations';

/**
 * Org Status Constants
 */
export const OrgStatus = {
    PENDING: 'pending',
    VERIFIED: 'verified',
    ACTIVE: 'active',
    SUSPENDED: 'suspended'
};

/**
 * Custom Hook for Org Service
 * Replicates the logic of OrgService.dart
 */
export function useOrgService() {
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(false);

    // Initial Load
    useEffect(() => {
        loadRegistrations();
    }, []);

    const loadRegistrations = () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                setRegistrations(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Failed to load org registrations:', e);
        }
    };

    const saveRegistrations = (regs) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(regs));
            setRegistrations(regs);
        } catch (e) {
            console.error('Failed to save org registrations:', e);
        }
    };

    const getPendingCount = () => registrations.filter(r => r.status === OrgStatus.PENDING).length;
    const getActiveCount = () => registrations.filter(r => r.status === OrgStatus.ACTIVE).length;

    /**
     * Check Availability
     */
    const checkAvailability = async (namespace) => {
        return await checkOrgAvailability(namespace);
    };

    /**
     * Register Organization
     */
    const register = async ({ namespace, organizationName, email, website, description, tier }) => {
        setLoading(true);
        const res = await registerOrg({
            namespace,
            organization_name: organizationName,
            email,
            website,
            description,
            tier
        });

        if (res.success) {
            const newReg = {
                id: res.data.registration_id,
                namespace,
                organizationName,
                domain: res.data.domain,
                email,
                description,
                tier,
                verificationCode: res.data.verification_code,
                txtRecordHost: res.data.instructions?.host,
                txtRecordValue: res.data.instructions?.value,
                status: OrgStatus.PENDING,
                createdAt: new Date().toISOString()
            };

            const updated = [...registrations.filter(r => r.namespace !== namespace), newReg];
            saveRegistrations(updated);
        }

        setLoading(false);
        return res;
    };

    /**
     * Verify DNS
     */
    const verifyDns = async (reg) => {
        setLoading(true);
        const res = await verifyOrgDns({
            registration_id: reg.id,
            domain: reg.domain,
            verification_code: reg.verificationCode
        });

        if (res.success && res.data?.verified) {
            // Update local status
            const updated = registrations.map(r =>
                r.id === reg.id ? { ...r, status: OrgStatus.VERIFIED, verifiedAt: new Date().toISOString() } : r
            );
            saveRegistrations(updated);
        }

        setLoading(false);
        return res;
    };

    /**
     * Activate (Mock Implementation for now as detailed activate API logic is complex)
     * In Flutter this calls _orgService.activate(namespace, pk)
     */
    const activate = async (reg, adminPk) => {
        setLoading(true);
        const res = await activateOrg(reg.namespace, adminPk, reg.email);

        if (res.success) {
            const updated = registrations.map(r =>
                r.id === reg.id ? { ...r, status: OrgStatus.ACTIVE, adminPk } : r
            );
            saveRegistrations(updated);
        }

        setLoading(false);
        return res;
    };

    /**
     * Sync with Server
     */
    const syncWithServer = async () => {
        setLoading(true);
        let changed = false;
        let newRegs = [...registrations];

        for (let i = 0; i < newRegs.length; i++) {
            const reg = newRegs[i];

            // Check verification if pending
            if (reg.status === OrgStatus.PENDING || reg.status === OrgStatus.VERIFIED) {
                try {
                    // Check if active
                    const infoRes = await fetch(`${GNS_API_BASE}/org/${reg.namespace}`);
                    const infoData = await infoRes.json();

                    if (infoData.success && infoData.data) {
                        newRegs[i] = { ...reg, status: OrgStatus.ACTIVE };
                        changed = true;
                        continue;
                    }

                    // Attempt verify check
                    const verifyRes = await verifyOrgDns({ domain: reg.domain });
                    if (verifyRes.success && verifyRes.data?.verified) {
                        if (reg.status !== OrgStatus.VERIFIED) {
                            newRegs[i] = { ...reg, status: OrgStatus.VERIFIED };
                            changed = true;
                        }
                    }
                } catch (e) {
                    console.warn('Sync failed for', reg.namespace);
                }
            }
        }

        if (changed) {
            saveRegistrations(newRegs);
        }
        setLoading(false);
    };

    const deleteRegistration = (namespace) => {
        const updated = registrations.filter(r => r.namespace !== namespace);
        saveRegistrations(updated);
    }

    return {
        registrations,
        loading,
        getPendingCount,
        getActiveCount,
        checkAvailability,
        register,
        verifyDns,
        activate,
        syncWithServer,
        deleteRegistration
    };
}
