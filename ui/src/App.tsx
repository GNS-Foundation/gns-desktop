/**
 * GNS Browser - Main Application Component
 * 
 * Routes between:
 * - WelcomeScreen (new users - no identity)
 * - MainLayout with tabs (existing users)
 * - Wallet screens (GNS tokens, send, history)
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { GSiteViewer, GSiteCreator } from './components/gsite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { hasIdentity, getCurrentHandle, getBreadcrumbStatus } from './lib/tauri';
import { profileToGSite } from './lib/gsite';
import { GSite } from './types/gsite';

// Components
import { WelcomeScreen } from './components/WelcomeScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { MainLayout } from './components/MainLayout';

// Tab Components
import { HomeTab } from './components/HomeTab';
import { MessagesTab } from './components/MessagesTab';
import { EmailTab } from './components/email/EmailTab';
import { BreadcrumbsTab } from './components/BreadcrumbsTab';
import { SettingsTab } from './components/settings';
import { ConversationScreen } from './components/ConversationScreen';
import { NewConversation } from './components/NewConversation';
import { HandleClaimScreen } from './components/HandleClaimScreen';
import { IdentityViewer } from './components/IdentityViewer';

// Wallet Components
import { GnsTokenScreen, SendMoneyScreen, PaymentHistoryScreen } from './components/wallet';
import { DixTimeline } from './pages/DixTimeline';
import { PostDetailPage } from './pages/PostDetailPage';
import { BrowserPairingScreen } from './components/BrowserPairingScreen';

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
  const [searchParams] = useSearchParams();
  const recipient = searchParams.get('recipient') || undefined;
  const amount = searchParams.get('amount') || undefined;

  return (
    <SendMoneyScreen
      onBack={() => window.history.back()}
      prefillRecipient={recipient}
      prefillAmount={amount}
    />
  );
}

function WalletHistoryRoute() {
  return <PaymentHistoryScreen onBack={() => window.history.back()} />;
}

// Helper for GSite Viewer
function GSiteViewerRoute() {
  const { handle } = useParams();
  const navigate = useNavigate();

  return (
    <GSiteViewer
      identifier={handle || ''}
      onBack={() => navigate(-1)}
      onMessage={(handle) => navigate(`/messages/new?recipient=${handle.replace('@', '')}`)}
      onPayment={(handle) => navigate(`/wallet/send?recipient=${handle.replace('@', '')}`)}
    />
  );
}

type AppScreen = 'loading' | 'welcome' | 'main';

function AppContent() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [error, setError] = useState<string | null>(null);
  const [collectionEnabled, setCollectionEnabled] = useState(false);

  // GSite State
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingGSite, setEditingGSite] = useState<GSite | undefined>(undefined);

  // Background breadcrumb collection - runs at app level
  useBreadcrumbCollection(collectionEnabled);

  // Check if identity exists on app start
  useEffect(() => {
    checkIdentity();
    loadCollectionState();
  }, []);

  const loadCollectionState = async () => {
    try {
      const status = await getBreadcrumbStatus();
      setCollectionEnabled(status.collection_enabled);
    } catch (err) {
      console.error('Failed to load collection state:', err);
    }
  };

  const checkIdentity = async () => {
    try {
      const exists = await hasIdentity();

      if (exists) {
        // Sync handle to local storage if missing or stale
        try {
          const handle = await getCurrentHandle();
          if (handle) {
            console.log('Synced identity handle:', handle);
            localStorage.setItem('gns_handle', handle);
          }
        } catch (e) {
          console.error('Failed to sync handle:', e);
        }
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

  // Handle identity deletion
  const handleIdentityDeleted = () => {
    console.log('Identity deleted - returning to welcome screen');
    setScreen('welcome');
  };

  // Loading screen
  if (screen === 'loading') {
    return <LoadingScreen message={error || undefined} />;
  }

  // Welcome screen for new users
  if (screen === 'welcome') {
    return <WelcomeScreen onComplete={handleWelcomeComplete} />;
  }

  // Main app
  return (
    <>
      <Routes>
        {/* Main tabs */}
        <Route element={<MainLayout onViewProfile={setViewingProfile} />}>
          <Route path="/" element={<HomeTab onViewGSite={setViewingProfile} />} />
          <Route path="/messages" element={<MessagesTab />} />
          <Route path="/messages/new" element={<NewConversation />} />
          <Route path="/messages/:threadId" element={<ConversationScreen />} />
          <Route path="/email" element={<EmailTab />} />
          <Route path="/breadcrumbs" element={<BreadcrumbsTab />} />
          <Route path="/breadcrumbs/claim" element={<HandleClaimScreen />} />
          <Route path="/settings" element={<SettingsTab onIdentityDeleted={handleIdentityDeleted} />} />
          <Route path="/identity" element={<IdentityViewer />} />
          <Route path="/dix" element={<DixTimeline />} />

          <Route path="/dix/post/:postId" element={<PostDetailPage />} />
          <Route path="/settings/browser-pairing" element={<BrowserPairingScreen />} />
        </Route>

        {/* Wallet routes (full-screen) */}
        <Route path="/wallet/tokens" element={<WalletTokensRoute />} />
        <Route path="/wallet/send" element={<WalletSendRoute />} />
        <Route path="/wallet/history" element={<WalletHistoryRoute />} />

        {/* Other full-screen routes */}
        <Route path="/claim" element={<HandleClaimScreen />} />
        <Route path="/identity/:publicKey" element={<IdentityViewer />} />
        <Route path="/@:handle" element={<IdentityViewer />} />

        {/* GSite Routes */}
        <Route
          path="/profile/:handle"
          element={<GSiteViewerRoute />}
        />
        <Route
          path="/profile/edit"
          element={
            <GSiteCreator
              handle=""
              onSave={() => window.history.back()}
              onBack={() => window.history.back()}
            />
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Overlays */}
      {viewingProfile && (
        <div className="fixed inset-0 z-50">
          <GSiteViewer
            identifier={viewingProfile}
            onBack={() => setViewingProfile(null)}
            onMessage={(handle) => {
              setViewingProfile(null);
              const h = handle.replace('@', '');
              navigate(`/messages/new?recipient=${h}`);
            }}
            onPayment={(handle) => {
              setViewingProfile(null);
              const h = handle.replace('@', '');
              navigate(`/wallet/send?recipient=${h}`);
            }}
            onEdit={(profile) => {
              setViewingProfile(null);
              setEditingGSite(profileToGSite(profile));
              setEditingProfile(true);
            }}
          />
        </div>
      )}

      {editingProfile && (
        <div className="fixed inset-0 z-50">
          <GSiteCreator
            existingGSite={editingGSite}
            handle={localStorage.getItem('gns_handle') || ''}
            onBack={() => {
              setEditingProfile(false);
              setEditingGSite(undefined);
            }}
            onSave={(gsite) => {
              setEditingProfile(false);
              setEditingGSite(undefined);
              setViewingProfile(gsite['@id']);
            }}
          />
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-text-primary transition-colors duration-300">
          <AppContent />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
