// MOCK IMPLEMENTATION TO FIX BUILD
// api-web missing exports

export const checkOrgAvailability = async () => ({ success: false, error: "Not implemented" });
export const registerOrg = async () => ({ success: false, error: "Not implemented" });
export const verifyOrgDns = async () => ({ success: false, error: "Not implemented" });
export const activateOrg = async () => ({ success: false, error: "Not implemented" });
export const GNS_API_BASE = "https://gns-api.example.com";

export const OrgStatus = {
    ACTIVE: 'active',
    PENDING: 'pending',
    SUSPENDED: 'suspended'
};

export function useOrgRegistration() {
    return {
        check: checkOrgAvailability,
        register: registerOrg,
        verify: verifyOrgDns
    };
}

export function useOrgService() {
    return {
        getOrganizations: async () => [],
        checkAvailability: checkOrgAvailability,
        registerOrg: registerOrg,
        verifyOrgDns: verifyOrgDns
    };
}
