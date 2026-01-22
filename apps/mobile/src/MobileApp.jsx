import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { HomeTab } from './screens/HomeTab';
import { MessagesTab } from './screens/MessagesTab';
import { ContactsTab } from './screens/ContactsTab';
import { HistoryTab } from './screens/HistoryTab';
import { SettingsTab } from './screens/SettingsTab';
import { TvRemoteScreen } from './screens/TvRemoteScreen';
import './MobileApp.css';

function TabsLayout() {
    const [activeTab, setActiveTab] = useState(0);

    const tabs = [
        { icon: '🏠', label: 'Home', component: HomeTab },
        { icon: '💬', label: 'Messages', component: MessagesTab },
        { icon: '👥', label: 'Contacts', component: ContactsTab },
        { icon: '📜', label: 'History', component: HistoryTab },
        { icon: '⚙️', label: 'Settings', component: SettingsTab },
    ];

    const ActiveComponent = tabs[activeTab].component;

    return (
        <div className="mobile-app">
            <div className="mobile-content">
                <ActiveComponent />
            </div>

            <nav className="mobile-bottom-nav">
                {tabs.map((tab, index) => (
                    <button
                        key={tab.label}
                        className={`nav-item ${activeTab === index ? 'active' : ''}`}
                        onClick={() => setActiveTab(index)}
                    >
                        <span className="nav-icon">{tab.icon}</span>
                        <span className="nav-label">{tab.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
}

import { FinancialHubScreen } from './screens/FinancialHubScreen';
import { SendMoneyScreen } from './screens/SendMoneyScreen';
import { TransactionHistoryScreen } from './screens/TransactionHistoryScreen';

import { ChatScreen } from './screens/ChatScreen';
import { ProfileEditor } from './screens/ProfileEditor';
import { HandleManagement } from './screens/HandleManagement';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { LoyaltyScreen } from './screens/LoyaltyScreen';
import { SubscriptionsScreen } from './screens/SubscriptionsScreen';
import { PaymentLinksScreen } from './screens/PaymentLinksScreen';

export default function MobileApp() {
    return (
        <Routes>
            <Route path="/" element={<TabsLayout />} />
            <Route path="/remote/:id" element={<TvRemoteScreen />} />
            <Route path="/financial" element={<FinancialHubScreen />} />
            <Route path="/financial/send" element={<SendMoneyScreen />} />
            <Route path="/financial/history" element={<TransactionHistoryScreen />} />
            <Route path="/financial/history" element={<TransactionHistoryScreen />} />
            <Route path="/chat/:threadId" element={<ChatScreen />} />
            <Route path="/profile/edit" element={<ProfileEditor />} />
            <Route path="/handle/manage" element={<HandleManagement />} />
            <Route path="/financial/analytics" element={<AnalyticsScreen />} />
            <Route path="/financial/loyalty" element={<LoyaltyScreen />} />
            <Route path="/financial/subscriptions" element={<SubscriptionsScreen />} />
            <Route path="/financial/links" element={<PaymentLinksScreen />} />
        </Routes>
    );
}
