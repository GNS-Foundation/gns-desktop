// ═══════════════════════════════════════════════════════════════════
// 🐆 PANTHERA v2 — The Complete Browser Shell
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/PantheraShell.tsx
//
// Orchestrator that composes all PANTHERA components:
//   AuthProvider    → session management (QR pairing)
//   AddressBar      → classifyInput() → route to view
//   HomePage        (new tab)
//   GSiteRenderer   (identity/gSite views)
//   LegacyWebView   (traditional web + trust overlay)
//   SearchResults   (identity search)
//   FacetSwitcher   (identity context)
//   QRLoginModal    (secure sign-in)
//
// Both apps/web and apps/desktop import this via @gns/ui.
// Platform-specific behavior is handled inside each component.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, ArrowRight, RotateCw, Home, Search,
  ShieldCheck, Globe, Star, Moon, Sun, Menu, X,
  User, Loader2, LogOut, Settings,
} from 'lucide-react';

import { classifyInput, InputType, ViewMode, FacetContext } from './classifier';
import type { ViewModeValue, FacetContextValue } from './classifier';
import { resolveHandle, searchHandles, fetchGSite } from './api';

import AuthProvider, { useAuth } from './AuthProvider';
import PantherLogo from './PantherLogo';
import AddressBar from './AddressBar';
import FacetSwitcher from './FacetSwitcher';
import GSiteRenderer from './GSiteRenderer';
import LegacyWebView from './LegacyWebView';
import HomePage from './HomePage';
import SearchResults from './SearchResults';
import QRLoginModal from './QRLoginModal';
import ThreadListView from './ThreadListView';
import ConversationView from './ConversationView';
import NewMessageView from './NewMessageView';

// ═══════════════════════════════════════════════════════════════════
// Wrapper: Provides AuthProvider context to the shell
// ═══════════════════════════════════════════════════════════════════

export default function PantheraShell() {
  return (
    <AuthProvider>
      <PantheraShellInner />
    </AuthProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Inner Shell (has access to auth context)
// ═══════════════════════════════════════════════════════════════════

function PantheraShellInner() {
  const auth = useAuth();

  // ─── State ───
  const [addressValue, setAddressValue] = useState('');
  const [viewMode, setViewMode] = useState<ViewModeValue>(ViewMode.HOME);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [activeFacet, setActiveFacet] = useState<FacetContextValue>(FacetContext.PERSONAL);

  // Content state
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [currentGSite, setCurrentGSite] = useState<any>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [currentDomain, setCurrentDomain] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Navigation history
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Auth UI
  const [showQRModal, setShowQRModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Messaging
  const [msgView, setMsgView] = useState<'threads' | 'conversation' | 'new'>('threads');
  const [chatPartnerPk, setChatPartnerPk] = useState<string | null>(null);
  const [chatPartnerHandle, setChatPartnerHandle] = useState<string | undefined>(undefined);

  // ─── Navigation ───
  const navigate = useCallback(async (input: string) => {
    if (!input || !input.trim()) return;

    // Close any open menus
    setShowUserMenu(false);

    // Handle internal routes
    if (input === '@me' && auth.handle) {
      input = `@${auth.handle}`;
    }
    if (input === 'messages') {
      setViewMode(ViewMode.MESSAGES);
      setAddressValue('messages');
      setMsgView('threads');
      setChatPartnerPk(null);
      return;
    }
    if (input === 'wallet') {
      // TODO: Wire wallet view
      console.log('Wallet view — coming soon');
      return;
    }

    const classified = classifyInput(input);

    // Push to history
    setHistory(prev => [...prev.slice(0, historyIndex + 1), input]);
    setHistoryIndex(prev => prev + 1);

    switch (classified.type) {
      case InputType.HANDLE:
      case InputType.FACET_HANDLE: {
        setIsLoading(true);
        setViewMode(ViewMode.LOADING);
        setAddressValue(classified.identifier || `@${classified.handle}`);

        const result = await resolveHandle(classified.handle!);
        if (result.success) {
          setCurrentProfile(result.profile);
          const gsiteResult = await fetchGSite(
            classified.identifier || `@${classified.handle}`
          );
          if (gsiteResult.success) setCurrentGSite(gsiteResult.gsite);
          setViewMode(ViewMode.GSITE);
        } else {
          setViewMode(ViewMode.ERROR);
        }
        setIsLoading(false);
        break;
      }

      case InputType.LEGACY_URL: {
        setAddressValue(classified.url!);
        setCurrentUrl(classified.url!);
        setCurrentDomain(classified.domain!);
        setViewMode(ViewMode.LEGACY_WEB);
        break;
      }

      case InputType.SEARCH: {
        setIsLoading(true);
        setViewMode(ViewMode.LOADING);
        setAddressValue(input);
        setSearchQuery(input);

        const result = await searchHandles(input);
        setSearchResults(result.results || []);
        setViewMode(ViewMode.SEARCH);
        setIsLoading(false);
        break;
      }

      default:
        break;
    }
  }, [historyIndex, auth.handle]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      navigate(history[newIndex]);
    } else {
      goHome();
    }
  }, [historyIndex, history, navigate]);

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      navigate(history[newIndex]);
    }
  }, [historyIndex, history, navigate]);

  const goHome = useCallback(() => {
    setViewMode(ViewMode.HOME);
    setAddressValue('');
    setCurrentProfile(null);
    setCurrentGSite(null);
    setCurrentUrl(null);
    setCurrentDomain(null);
    setShowUserMenu(false);
  }, []);

  const refresh = useCallback(() => {
    if (history[historyIndex]) navigate(history[historyIndex]);
  }, [history, historyIndex, navigate]);

  // ─── QR Login handlers ───
  const handleSignInClick = useCallback(() => {
    setShowQRModal(true);
  }, []);

  const handleLoginSuccess = useCallback((sessionData: any) => {
    auth.onLoginSuccess(sessionData);
    setShowQRModal(false);
  }, [auth]);

  // ─── Sign out ───
  const handleSignOut = useCallback(() => {
    auth.signOut();
    setShowUserMenu(false);
    goHome();
  }, [auth, goHome]);

  // ─── Close user menu on outside click ───
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = () => setShowUserMenu(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showUserMenu]);

  // ─── Tab title ───
  const tabTitle = useMemo(() => {
    switch (viewMode) {
      case ViewMode.HOME:       return 'New Tab';
      case ViewMode.GSITE:      return currentProfile?.displayName || currentProfile?.handle || 'gSite';
      case ViewMode.LEGACY_WEB: return currentDomain || 'Web';
      case ViewMode.SEARCH:     return `Search: ${searchQuery}`;
      case ViewMode.MESSAGES:   return 'Messages';
      default:                  return 'PANTHERA';
    }
  }, [viewMode, currentProfile, currentDomain, searchQuery]);

  // ─── View mode badge ───
  const viewIndicator = useMemo(() => {
    switch (viewMode) {
      case ViewMode.GSITE:      return { label: 'Identity Web', color: 'text-cyan-600', bg: 'bg-cyan-50' };
      case ViewMode.LEGACY_WEB: return { label: 'Legacy Web',   color: 'text-gray-500', bg: 'bg-gray-50' };
      case ViewMode.SEARCH:     return { label: 'TrIP Search',  color: 'text-amber-600', bg: 'bg-amber-50' };
      default:                  return null;
    }
  }, [viewMode]);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className={`h-screen flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>

      {/* ═══════ Browser Chrome ═══════ */}
      <div className={`${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
      } border-b px-3 py-2 flex-shrink-0`}>

        {/* Tab bar */}
        <div className="flex items-center mb-2">
          <div className={`flex items-center ${
            darkMode ? 'bg-gray-900' : 'bg-white'
          } rounded-t-lg px-4 py-1.5 text-sm max-w-xs`}>
            <PantherLogo size={16} className="mr-2 flex-shrink-0" />
            <span className={`truncate font-medium ${
              darkMode ? 'text-gray-200' : 'text-gray-700'
            }`}>
              {tabTitle}
            </span>
            <button className="ml-3 p-0.5 hover:bg-gray-200 rounded">
              <X size={13} className="text-gray-400" />
            </button>
          </div>
          <button className="ml-2 text-gray-400 p-1 text-lg hover:bg-gray-200 rounded">
            +
          </button>
        </div>

        {/* Navigation bar */}
        <div className="flex items-center gap-1.5">
          {/* Nav buttons */}
          <button
            onClick={goBack}
            disabled={historyIndex <= 0}
            className={`p-2 rounded-lg ${
              historyIndex > 0
                ? 'hover:bg-gray-200 text-gray-600'
                : 'text-gray-300'
            }`}
          >
            <ArrowLeft size={17} />
          </button>
          <button
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            className={`p-2 rounded-lg ${
              historyIndex < history.length - 1
                ? 'hover:bg-gray-200 text-gray-600'
                : 'text-gray-300'
            }`}
          >
            <ArrowRight size={17} />
          </button>
          <button
            onClick={refresh}
            className="p-2 rounded-lg hover:bg-gray-200 text-gray-500"
          >
            <RotateCw size={17} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={goHome}
            className="p-2 rounded-lg hover:bg-gray-200 text-gray-500"
          >
            <Home size={17} />
          </button>

          {/* ═══════ ADDRESS BAR ═══════ */}
          <AddressBar
            value={addressValue}
            onChange={setAddressValue}
            onNavigate={navigate}
            viewMode={viewMode}
            isLoading={isLoading}
          />

          {/* View mode indicator */}
          {viewIndicator && (
            <div className={`hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${viewIndicator.bg} ${viewIndicator.color}`}>
              {viewMode === ViewMode.GSITE && <ShieldCheck size={13} />}
              {viewMode === ViewMode.LEGACY_WEB && <Globe size={13} />}
              {viewMode === ViewMode.SEARCH && <Search size={13} />}
              {viewIndicator.label}
            </div>
          )}

          {/* Facet switcher — only when authenticated */}
          {auth.isAuthenticated && auth.handle && (
            <FacetSwitcher
              activeFacet={activeFacet}
              onSwitch={setActiveFacet}
              handle={auth.handle}
            />
          )}

          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg hover:bg-gray-200 text-gray-500"
          >
            {darkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button className="p-2 rounded-lg hover:bg-gray-200 text-gray-500">
            <Star size={17} />
          </button>

          {/* ═══════ AUTH BUTTON ═══════ */}
          {auth.isAuthenticated ? (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 rounded-lg text-cyan-600 text-sm font-medium transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-white text-[10px] font-bold">
                  {(auth.handle || '?')[0].toUpperCase()}
                </div>
                <span className="hidden sm:inline">@{auth.handle}</span>
              </button>

              {/* User dropdown menu */}
              {showUserMenu && (
                <div
                  className={`absolute right-0 top-full mt-1 w-56 rounded-xl shadow-xl border z-50 py-1 ${
                    darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* User info header */}
                  <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                    <p className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      @{auth.handle}
                    </p>
                    <p className={`text-xs mt-0.5 font-mono ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {auth.publicKey?.substring(0, 16)}...
                    </p>
                  </div>

                  {/* Menu items */}
                  <button
                    onClick={() => { navigate(`@${auth.handle}`); setShowUserMenu(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${
                      darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <User size={16} />
                    My Profile
                  </button>

                  <button
                    onClick={() => { /* TODO: Settings view */ setShowUserMenu(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${
                      darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Settings size={16} />
                    Settings
                  </button>

                  <div className={`my-1 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`} />

                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleSignInClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-white text-sm font-medium transition-colors"
            >
              <User size={15} /> Sign in
            </button>
          )}

          <button className="p-2 rounded-lg hover:bg-gray-200 text-gray-500">
            <Menu size={17} />
          </button>
        </div>
      </div>

      {/* ═══════ Content Area ═══════ */}
      <div className={`flex-1 overflow-auto ${
        darkMode ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-900'
      }`}>
        {viewMode === ViewMode.HOME && (
          <HomePage onNavigate={navigate} darkMode={darkMode} />
        )}

        {viewMode === ViewMode.LOADING && (
          <div className="flex-1 flex items-center justify-center py-32">
            <div className="text-center">
              <Loader2 size={32} className="text-cyan-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Resolving identity...</p>
            </div>
          </div>
        )}

        {viewMode === ViewMode.GSITE && (
          <GSiteRenderer
            profile={currentProfile}
            gsite={currentGSite}
            onNavigate={navigate}
            onMessage={(p) => {
              setViewMode(ViewMode.MESSAGES);
              setAddressValue('messages');
              setMsgView('conversation');
              setChatPartnerPk(p.publicKey || p.public_key);
              setChatPartnerHandle(p.handle);
            }}
            onPay={(p) => console.log('Pay:', p.handle)}
          />
        )}

        {viewMode === ViewMode.LEGACY_WEB && currentUrl && currentDomain && (
          <LegacyWebView
            url={currentUrl}
            domain={currentDomain}
            onNavigate={navigate}
          />
        )}

        {viewMode === ViewMode.SEARCH && (
          <SearchResults
            query={searchQuery}
            results={searchResults}
            onNavigate={navigate}
          />
        )}

        {viewMode === ViewMode.MESSAGES && (
          <>
            {msgView === 'threads' && (
              <ThreadListView
                onSelectThread={(pk, handle) => {
                  setMsgView('conversation');
                  setChatPartnerPk(pk);
                  setChatPartnerHandle(handle);
                }}
                onNewMessage={() => setMsgView('new')}
                darkMode={darkMode}
              />
            )}
            {msgView === 'conversation' && chatPartnerPk && (
              <ConversationView
                partnerPublicKey={chatPartnerPk}
                partnerHandle={chatPartnerHandle}
                onBack={() => { setMsgView('threads'); setChatPartnerPk(null); }}
                darkMode={darkMode}
              />
            )}
            {msgView === 'new' && (
              <NewMessageView
                onSelectRecipient={(pk, handle) => {
                  setMsgView('conversation');
                  setChatPartnerPk(pk);
                  setChatPartnerHandle(handle);
                }}
                onBack={() => setMsgView('threads')}
                darkMode={darkMode}
              />
            )}
          </>
        )}

        {viewMode === ViewMode.ERROR && (
          <div className="flex-1 flex items-center justify-center py-32">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Search size={32} className="text-gray-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-700 mb-1">
                Identity not found
              </h2>
              <p className="text-sm text-gray-500">
                No GNS identity matches <strong>{addressValue}</strong>
              </p>
              <button
                onClick={goHome}
                className="mt-4 px-5 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors"
              >
                Go home
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ Status Bar ═══════ */}
      <div className={`flex items-center justify-between px-4 py-1 text-[11px] border-t ${
        darkMode
          ? 'bg-gray-800 border-gray-700 text-gray-500'
          : 'bg-gray-50 border-gray-200 text-gray-400'
      }`}>
        <div className="flex items-center gap-3">
          {viewMode === ViewMode.GSITE && currentProfile && (
            <span>
              Identity Web · @{currentProfile.handle} · Trust{' '}
              {currentProfile.trustScore || 0}%
            </span>
          )}
          {viewMode === ViewMode.LEGACY_WEB && (
            <span>Legacy Web · {currentDomain}</span>
          )}
          {viewMode === ViewMode.HOME && (
            <span>PANTHERA v2.0</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {auth.isAuthenticated && (
            <span className="hidden md:inline text-cyan-500/70">
              ● @{auth.handle}
            </span>
          )}
          <span className="hidden md:inline">Facet: {activeFacet}@</span>
          <span>Ed25519</span>
        </div>
      </div>

      {/* ═══════ QR Login Modal ═══════ */}
      <QRLoginModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        onSuccess={handleLoginSuccess}
        darkMode={darkMode}
      />
    </div>
  );
}
