import React from 'react';
import { X, ArrowLeft, ArrowRight, RotateCw, Home, Search, Loader2, Star, Sun, Moon, Inbox, Wifi, WifiOff, User, LogOut, Menu } from 'lucide-react';
import PantherLogo from '../common/PantherLogo';

const BrowserChrome = ({
    theme,
    currentView,
    addressBar,
    currentProfile,
    isLoading,
    unreadCount,
    wsConnected,
    authUser,
    goHome,
    fetchProfile,
    handleSearch,
    setDarkMode,
    darkMode,
    openMessages,
    setShowSignIn,
    handleSignOut
}) => {
    return (
        <div className={`${theme.bgSecondary} border-b ${theme.border} px-3 py-2`}>
            <div className="flex items-center mb-2">
                <div className={`flex items-center ${theme.bgTertiary} rounded-t-lg px-4 py-2 text-sm ${theme.text}`}>
                    <PantherLogo size={18} className="mr-2" />
                    <span className="max-w-40 truncate font-medium">
                        {currentView === 'home' ? 'New Tab' : currentView === 'messages' ? 'Messages' : addressBar || 'Panthera'}
                    </span>
                    <button className={`ml-3 ${theme.hover} rounded p-0.5 ${theme.textSecondary}`}><X size={14} /></button>
                </div>
                <button className={`ml-2 ${theme.textMuted} p-1 text-lg`}>+</button>
            </div>

            <div className="flex items-center gap-2">
                <button onClick={() => currentView !== 'home' && goHome()} className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}><ArrowLeft size={18} /></button>
                <button className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}><ArrowRight size={18} /></button>
                <button onClick={() => currentProfile && fetchProfile(currentProfile.handle)} className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}>
                    <RotateCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </button>
                <button onClick={goHome} className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}><Home size={18} /></button>

                <form onSubmit={(e) => { e.preventDefault(); const val = e.target.elements.addressInput.value; if (val.trim()) handleSearch(val); }} className="flex-1">
                    <div className={`flex items-center ${theme.bgTertiary} rounded-full px-4 py-2 border ${theme.border} focus-within:border-cyan-500`}>
                        <span className="text-cyan-500 font-semibold mr-1">@</span>
                        <input name="addressInput" type="text" defaultValue={addressBar} placeholder="Search @handles..." className={`bg-transparent flex-1 ${theme.text} text-sm outline-none placeholder-gray-400`} />
                        {isLoading ? <Loader2 size={16} className="text-cyan-500 animate-spin" /> : <Search size={16} className={theme.textMuted} />}
                    </div>
                </form>

                <button className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}><Star size={18} /></button>
                <button onClick={() => setDarkMode(!darkMode)} className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}>
                    {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                {/* ✅ NEW: Messages button */}
                <button
                    onClick={openMessages}
                    className={`p-2 ${theme.hover} rounded relative ${currentView === 'messages' ? 'text-cyan-500' : theme.textSecondary}`}
                    title="Messages"
                >
                    <Inbox size={18} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {/* Connection status */}
                <div className={`p-2 ${theme.textSecondary}`} title={wsConnected ? 'Connected' : 'Disconnected'}>
                    {wsConnected ? <Wifi size={18} className="text-green-500" /> : <WifiOff size={18} className="text-gray-400" />}
                </div>

                {/* Auth button */}
                {authUser ? (
                    <div className="flex items-center gap-2">
                        <button onClick={() => fetchProfile(authUser.handle)} className="flex items-center gap-2 px-3 py-2 bg-cyan-500/20 rounded-full text-cyan-500 text-sm font-medium hover:bg-cyan-500/30">
                            <span className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center text-white text-xs">
                                {authUser.displayName?.[0] || authUser.handle?.[0]?.toUpperCase()}
                            </span>
                            <span>@{authUser.handle}</span>
                        </button>
                        <button onClick={handleSignOut} className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`} title="Sign out">
                            <LogOut size={18} />
                        </button>
                    </div>
                ) : (
                    <button onClick={() => setShowSignIn(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white text-sm font-medium">
                        <User size={16} /><span>Sign in</span>
                    </button>
                )}

                <button className={`p-2 ${theme.hover} rounded ${theme.textSecondary}`}><Menu size={18} /></button>
            </div>
        </div>
    );
};

export default BrowserChrome;
