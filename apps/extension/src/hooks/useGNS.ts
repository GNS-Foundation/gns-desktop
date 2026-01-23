import { useState, useEffect } from 'react';
import init, * as GnsWasm from '../wasm/gns_crypto_wasm';

// Interface matching WASM exports
export interface GnsIdentity {
    public_key: string;
    private_key: string;
    encryption_key: string;
}

export const useGNS = () => {
    const [isPaired, setIsPaired] = useState(false);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [identity, setIdentity] = useState<GnsIdentity | null>(null);

    useEffect(() => {
        const loadWasm = async () => {
            try {
                await init();
                setStatus('ready');

                // Load or create identity
                // In real app: await chrome.storage.local.get(...)
                const stored = localStorage.getItem('gns_identity');
                if (stored) {
                    setIdentity(JSON.parse(stored));
                } else {
                    const newId = GnsWasm.generate_identity();
                    setIdentity(newId);
                    localStorage.setItem('gns_identity', JSON.stringify(newId));
                }
            } catch (e) {
                console.error("Failed to load WASM", e);
                setStatus('error');
            }
        };
        loadWasm();
    }, []);

    const pairDevice = async () => {
        if (status !== 'ready') return;

        // Simulate pairing process
        setTimeout(() => {
            setIsPaired(true);
        }, 1000);
    };

    const generateProof = () => {
        if (!identity) return null;
        // Mock lat/lon for now. In real app, this comes from Mobile via Relay
        // But for "Proof of Trajectory", the Extension actually signs the *Relay Verified* proof?
        // Or just signs a challenge using its Extension Key.
        // Let's sign a breadcrumb as a demo.
        const lat = 37.7749;
        const lon = -122.4194;
        return GnsWasm.create_signed_breadcrumb(identity.private_key, lat, lon);
    };

    return { isPaired, pairDevice, status, generateProof, identity };
};
