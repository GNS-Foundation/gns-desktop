// Platform detection utility
export function isMobilePlatform() {
    // Check if running in Tauri mobile environment
    if (typeof window !== 'undefined' && window.__TAURI__) {
        const platform = window.__TAURI_INTERNALS__?.metadata.currentPlatform;
        if (platform === 'ios' || platform === 'android') {
            return true;
        }
    }

    // Fallback: Check window width for responsive design
    if (typeof window !== 'undefined') {
        return window.innerWidth < 768;
    }

    return false;
}
