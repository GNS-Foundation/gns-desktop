import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useIdentity } from '../hooks/useIdentity';
import { useBreadcrumbs } from '../hooks/useBreadcrumbs';
import { usePayments } from '../hooks/usePayments';
import { IdentityCard } from '../components/IdentityCard';
import { BreadcrumbControls } from '../components/BreadcrumbControls';
import { HandleCard } from '../components/HandleCard';
import { SearchBar } from '../components/SearchBar';
import { GnsTokenCard } from '../components/GnsTokenCard';
import { PaymentsCard } from '../components/PaymentsCard';
import { FloatingNfcButton } from '../components/FloatingNfcButton';
import { ReadyToPaySheet } from '../components/ReadyToPaySheet';
import { QrScanner } from '../components/QrScanner';
import './HomeTab.css';

export function HomeTab() {
    const navigate = useNavigate();
    const { identity, loading: identityLoading, create } = useIdentity();
    const { status, start, stop, drop, loading: breadcrumbsLoading } = useBreadcrumbs();
    const { dailyStats, pendingCount } = usePayments();
    const [showPaySheet, setShowPaySheet] = React.useState(false);
    const [showScanner, setShowScanner] = useState(false);

    // Smart Home State
    const [hubs, setHubs] = useState([]);
    const [devices, setDevices] = useState([]);
    const [scanning, setScanning] = useState(false);

    useEffect(() => {
        // Auto-discover on load
        discoverHubs();
    }, []);

    const discoverHubs = async () => {
        setScanning(true);
        try {
            console.log('Scanning for hubs...');
            const foundHubs = await invoke('discover_hubs', { timeoutMs: 2000 });
            console.log('Hubs found:', foundHubs);
            setHubs(foundHubs);

            // Get devices from all hubs
            let allDevices = [];
            for (const hub of foundHubs) {
                if (hub.url) {
                    try {
                        const devs = await invoke('get_devices', { hubUrl: hub.url });
                        allDevices = [...allDevices, ...devs];
                    } catch (e) {
                        console.error('Failed to get devices from hub:', hub.name, e);
                    }
                }
            }
            // Mock devices if none found (for testing UI without real hub)
            if (allDevices.length === 0) {
                allDevices = [
                    { id: 'mock-tv', name: 'Living Room TV (Mock)', type: 'tv', status: { online: true, state: {} } }
                ];
            }
            setDevices(allDevices);
        } catch (e) {
            console.error('Discovery failed:', e);
        } finally {
            setScanning(false);
        }
    };

    const handleSearch = async (query) => {
        // TODO: Implement handle search/resolution
        console.log('Searching for:', query);
        alert(`Searching for @${query}`);
    };

    const handleCreateIdentity = async (name) => {
        console.log('[HomeTab] Creating identity:', name);
        try {
            await create(name);
        } catch (err) {
            console.error(err);
            alert("Failed to create identity: " + err.message);
        }
    };

    const handleManageHandle = () => {
        navigate('/handle/manage');
    };

    const handleViewGnsWallet = () => {
        navigate('/financial');
    };

    const handleViewPayments = () => {
        navigate('/financial');
    };

    const handleEditProfile = () => {
        navigate('/profile/edit');
    };

    if (identityLoading) {
        return <div className="home-tab loading">Loading...</div>;
    }

    return (
        <div className="home-tab">
            <header className="home-header">
                <h1>GLOBE CRUMBS</h1>
                <div className="header-actions">
                    <button className="header-btn" title="Pair Browser">📷</button>
                    <button className="header-btn" title="Share Identity">📤</button>
                </div>
            </header>

            <div className="home-content">
                <IdentityCard
                    identity={identity}
                    onEdit={handleEditProfile}
                    onCreate={handleCreateIdentity}
                />

                {/* Smart Home Section */}
                <div className="smart-home-section" style={{ padding: '0 16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0, color: '#888', fontSize: '14px' }}>SMART HOME</h3>
                        <button onClick={discoverHubs} style={{ background: 'none', border: 'none', color: '#6c5ce7', fontSize: '12px' }}>
                            {scanning ? 'Scanning...' : 'Scan'}
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
                        {devices.map(device => (
                            <div
                                key={device.id}
                                onClick={() => navigate(`/remote/${device.id}`)}
                                style={{
                                    minWidth: '100px',
                                    padding: '12px',
                                    background: '#2a2a2a',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    border: '1px solid #333'
                                }}
                            >
                                <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                                    {device.type === 'tv' ? '📺' : '📱'}
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {device.name}
                                </div>
                                <div style={{ fontSize: '10px', color: device.status.online ? '#2ecc71' : '#95a5a6' }}>
                                    {device.status.online ? 'Online' : 'Offline'}
                                </div>
                            </div>
                        ))}
                        {devices.length === 0 && !scanning && (
                            <div style={{ color: '#666', fontSize: '12px', padding: '10px' }}>No devices found</div>
                        )}
                    </div>
                </div>

                <BreadcrumbControls
                    status={status}
                    onStart={start}
                    onStop={stop}
                    onDrop={drop}
                />

                <SearchBar onSearch={handleSearch} />

                <HandleCard
                    identity={identity}
                    onManage={handleManageHandle}
                />

                <GnsTokenCard
                    balance={0}
                    claimable={0}
                    loading={false}
                    onTap={handleViewGnsWallet}
                />

                <PaymentsCard
                    stats={dailyStats}
                    pendingCount={pendingCount}
                    onTap={handleViewPayments}
                />

                {/* Bottom spacer for FAB */}
                <div style={{ height: '80px' }}></div>
            </div>

            <FloatingNfcButton onTap={() => setShowPaySheet(true)} />

            {showPaySheet && (
                <ReadyToPaySheet
                    onClose={() => setShowPaySheet(false)}
                    onScanQr={() => {
                        setShowPaySheet(false);
                        setShowScanner(true);
                    }}
                />
            )}

            {showScanner && (
                <QrScanner
                    onResult={(result) => {
                        console.log('QR Code Scanned:', result);
                        setShowScanner(false);
                        alert(`Scanned: ${result}`);
                        // TODO: Handle paired browser or payment URL
                    }}
                    onCancel={() => setShowScanner(false)}
                />
            )}
        </div>
    );
}
