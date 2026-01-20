import React, { useEffect, useState } from 'react';
import { scan, Format, cancel } from '@tauri-apps/plugin-barcode-scanner';
import './QrScanner.css';

export function QrScanner({ onResult, onCancel }) {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const startScan = async () => {
            try {
                // Request permission first (plugin handles it usually, but good to be explicit if needed)
                // Note: The plugin automatically requests permission on scan call

                // Start scanning
                // windowed: false means full screen native UI on mobile
                const result = await scan({
                    windowed: false,
                    formats: [Format.QRCode]
                });

                if (active && result.content) {
                    onResult(result.content);
                }
            } catch (e) {
                console.error('Scan failed:', e);
                if (active) {
                    // Check if cancelled by user
                    if (e.toString().includes('cancelled') || e.toString().includes('canceled')) {
                        onCancel();
                    } else {
                        alert('Scanner error: ' + e);
                        onCancel();
                    }
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        startScan();

        return () => {
            active = false;
            cancel().catch(() => { }); // Attempt to cancel if unmounting
        };
    }, [onResult, onCancel]);

    // On mobile, the native camera view sits ON TOP of the WebView.
    // So this HTML is technically behind the camera view, 
    // BUT some plugins allow HTML overlay or transparency.
    // For this specific plugin, `windowed: false` usually means pure native view 
    // which might obscure everything, OR it might be transparent.
    // If it obscures everything, this cancel button might not be clickable unless 
    // the plugin provides its own UI controls.
    //
    // However, often the plugin provides a "Cancel" or "Back" button in the native UI.
    // If not, we rely on the user using system "Back" gesture.

    return (
        <div className="qr-scanner-overlay">
            {loading && <div className="qr-loading">Starting camera...</div>}

            {/* 
               If the plugin supports overlaying webview on top of camera (transparent background), 
               then this button would be visible. 
               If not, this is hidden by the native camera layer.
               We'll include it just in case or for desktop testing scenarios.
            */}
            <div className="qr-scanner-controls">
                <button className="qr-cancel-btn" onClick={() => {
                    cancel().catch(console.error);
                    onCancel();
                }}>
                    Cancel Scan
                </button>
            </div>
        </div>
    );
}
