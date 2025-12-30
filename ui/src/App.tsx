/**
 * GNS Browser - Main Application Component
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useIdentity } from './lib/tauri';
import { WelcomeScreen } from './components/WelcomeScreen';
import { MainLayout } from './components/MainLayout';
import { HomeTab } from './components/HomeTab';
import { MessagesTab } from './components/MessagesTab';
import { ConversationScreen } from './components/ConversationScreen';
import { BreadcrumbsTab } from './components/BreadcrumbsTab';
import { SettingsTab } from './components/SettingsTab';
import { HandleClaimScreen } from './components/HandleClaimScreen';
import { IdentityViewer } from './components/IdentityViewer';
import { LoadingScreen } from './components/LoadingScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 2,
    },
  },
});

function AppContent() {
  const { publicKey, handle, loading, error } = useIdentity();
  const [isOnboarding, setIsOnboarding] = useState(false);

  // Show loading while checking identity
  if (loading) {
    return <LoadingScreen message="Loading identity..." />;
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 max-w-md">
          <h2 className="text-red-400 font-semibold mb-2">Error Loading Identity</h2>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // No identity - show welcome/onboarding
  if (!publicKey) {
    return <WelcomeScreen onComplete={() => setIsOnboarding(false)} />;
  }

  // Has identity - show main app
  return (
    <BrowserRouter>
      <Routes>
        {/* Main tabs */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomeTab />} />
          <Route path="messages" element={<MessagesTab />} />
          <Route path="messages/:threadId" element={<ConversationScreen />} />
          <Route path="breadcrumbs" element={<BreadcrumbsTab />} />
          <Route path="settings" element={<SettingsTab />} />
        </Route>

        {/* Full-screen routes */}
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
