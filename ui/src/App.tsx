/**
 * GNS Browser - Main Application Component
 * 
 * Routes between:
 * - WelcomeScreen (new users - no identity)
 * - MainLayout with tabs (existing users)
 * - Wallet screens (GNS tokens, send, history)
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { hasIdentity } from './lib/tauri';

// Components
import { WelcomeScreen } from './components/WelcomeScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { MainLayout } from './components/MainLayout';

// Tab Components
import { HomeTab } from './components/HomeTab';
import { MessagesTab } from './components/MessagesTab';
import { BreadcrumbsTab } from './components/BreadcrumbsTab';
import { SettingsTab } from './components/SettingsTab';
import { ConversationScreen } from './components/ConversationScreen';
import { NewConversation } from './components/NewConversation';
import { HandleClaimScreen } from './components/HandleClaimScreen';
import { IdentityViewer } from './components/IdentityViewer';

// Wallet Components
import { GnsTokenScreen, SendMoneyScreen, PaymentHistoryScreen } from './components/wallet';
import { DixTimeline } from './pages/DixTimeline';
import { PostDetailPage } from './pages/PostDetailPage';

// Hooks
import { useBreadcrumbCollection } from './hooks/useBreadcrumbCollection';

// Query Client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 2,
    },
  },
});

// Wallet route wrappers
function WalletTokensRoute() {
  return <GnsTokenScreen onBack={() => window.history.back()} />;
}

function WalletSendRoute() {
  return <SendMoneyScreen onBack={() => window.history.back()} />;
}

function WalletHistoryRoute() {
  return <PaymentHistoryScreen onBack={() => window.history.back()} />;
}

type AppScreen = 'loading' | 'welcome' | 'main';

function AppContent() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [error, setError] = useState<string | null>(null);
  const [collectionEnabled, setCollectionEnabled] = useState(false);

  // Background breadcrumb collection - runs at app level
  useBreadcrumbCollection(collectionEnabled);

  // Check if identity exists on app start
  useEffect(() => {
    checkIdentity();
    loadCollectionState();
  }, []);

  const loadCollectionState = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke<any>('get_breadcrumb_status');
      setCollectionEnabled(status.collection_enabled);
    } catch (err) {
      console.error('Failed to load collection state:', err);
    }
  };

  const checkIdentity = async () => {
    try {
      const exists = await hasIdentity();

      if (exists) {
        setScreen('main');
      } else {
        setScreen('welcome');
      }
    } catch (err) {
      console.error('Failed to check identity:', err);
      setError('Failed to initialize app');
      // Default to welcome screen on error
      setScreen('welcome');
    }
  };

  // Handle welcome screen completion
  const handleWelcomeComplete = () => {
    console.log('Welcome complete - identity created');
    setScreen('main');
  };

  // Loading screen
  if (screen === 'loading') {
    return <LoadingScreen message={error || undefined} />;
  }

  // Welcome screen for new users
  if (screen === 'welcome') {
    return <WelcomeScreen onComplete={handleWelcomeComplete} />;
  }

  // Main app with React Router for existing users
  return (
    <BrowserRouter>
      <Routes>
        {/* Main tabs */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomeTab />} />
          <Route path="/messages" element={<MessagesTab />} />
          <Route path="/messages/new" element={<NewConversation />} />
          <Route path="/messages/:threadId" element={<ConversationScreen />} />
          <Route path="/breadcrumbs" element={<BreadcrumbsTab />} />
          <Route path="/breadcrumbs/claim" element={<HandleClaimScreen />} />
          <Route path="/settings" element={<SettingsTab />} />
          <Route path="/identity" element={<IdentityViewer />} />
          <Route path="/dix" element={<DixTimeline />} />
          <Route path="/dix/post/:postId" element={<PostDetailPage />} />
        </Route>

        {/* Wallet routes (full-screen) */}
        <Route path="/wallet/tokens" element={<WalletTokensRoute />} />
        <Route path="/wallet/send" element={<WalletSendRoute />} />
        <Route path="/wallet/history" element={<WalletHistoryRoute />} />

        {/* Other full-screen routes */}
        <Route path="/claim" element={<HandleClaimScreen />} />
        <Route path="/identity/:publicKey" element={<IdentityViewer />} />
        <Route path="/@:handle" element={<IdentityViewer />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-slate-900 text-white">
        <AppContent />
      </div>
    </QueryClientProvider>
  );
}
