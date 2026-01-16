import React from 'react';
import { useIdentity } from '../hooks/useIdentity';
import { useBreadcrumbs } from '../hooks/useBreadcrumbs';
import { usePayments } from '../hooks/usePayments';
import { IdentityCard } from '../components/IdentityCard';
import { BreadcrumbControls } from '../components/BreadcrumbControls';
import { HandleCard } from '../components/HandleCard';
import { SearchBar } from '../components/SearchBar';
import { GnsTokenCard } from '../components/GnsTokenCard';
import { PaymentsCard } from '../components/PaymentsCard';
import './HomeTab.css';

export function HomeTab() {
    const { identity, loading: identityLoading, create } = useIdentity();
    const { status, start, stop, drop, loading: breadcrumbsLoading } = useBreadcrumbs();
    const { dailyStats, pendingCount } = usePayments();

    const handleSearch = async (query) => {
        // TODO: Implement handle search/resolution
        console.log('Searching for:', query);
        alert(`Searching for @${query}`);
    };

    const handleCreateIdentity = async (name) => {
        console.log('[HomeTab] Creating identity:', name);
        try {
            await create(name);
            // Alert is optional now if UI updates automatically, but good for confirmation
            // alert(`Identity '${name}' created!`); 
        } catch (err) {
            console.error(err);
            alert("Failed to create identity: " + err.message);
        }
    };

    const handleManageHandle = () => {
        // TODO: Navigate to handle management screen
        alert('Handle Management - Coming soon');
    };

    const handleViewGnsWallet = () => {
        // TODO: Navigate to GNS token screen
        alert('GNS Token Wallet - Coming soon');
    };

    const handleViewPayments = () => {
        // TODO: Navigate to financial hub
        alert('Financial Hub - Coming soon');
    };

    const handleEditProfile = () => {
        // TODO: Navigate to profile editor
        alert('Profile Editor - Coming soon');
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
            </div>
        </div>
    );
}
