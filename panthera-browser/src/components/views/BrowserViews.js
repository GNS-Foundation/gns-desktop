import React from 'react';
import { Search, Loader2, Download, User, Building, MapPin, Package, MessageCircle, Check, Copy, ExternalLink } from 'lucide-react';
import PantherLogo from '../common/PantherLogo';
import { useTheme } from '../../context/ThemeContext';

// ==========================================
// HOME PAGE - Default View
// ==========================================
export const HomePage = ({ handleSearch, isLoading, shortcuts, setCurrentView, setAddressBar }) => {
    const { theme } = useTheme();
    return (
        <div className={`min-h-full ${theme.bg} flex flex-col items-center justify-center px-4 py-12`}>
            <PantherLogo size={140} className="mb-6" />
            <h1 className={`text-5xl font-bold ${theme.text} mb-2 tracking-tight`}>PANTHERA</h1>
            <p className={`${theme.textSecondary} text-lg mb-12`}>Browse the Identity Web</p>

            <form onSubmit={(e) => { e.preventDefault(); const val = e.target.elements.homeSearch.value; if (val) handleSearch(val); }} className="w-full max-w-2xl mb-12">
                <div className={`flex items-center ${theme.bgSecondary} border-2 ${theme.border} rounded-full px-6 py-4 hover:border-cyan-400 focus-within:border-cyan-500 focus-within:shadow-lg focus-within:shadow-cyan-500/20`}>
                    <span className="text-cyan-500 text-2xl font-semibold mr-2">@</span>
                    <input name="homeSearch" type="text" placeholder="Search handles..." className={`bg-transparent flex-1 ${theme.text} text-xl outline-none placeholder-gray-400`} />
                    <button type="submit" className={`p-2 ${theme.hover} rounded-full`} disabled={isLoading}>
                        {isLoading ? <Loader2 size={24} className="text-cyan-500 animate-spin" /> : <Search size={24} className="text-cyan-500" />}
                    </button>
                </div>
            </form>

            <div className="flex gap-6 md:gap-8 mb-16 flex-wrap justify-center">
                {shortcuts.map((s) => (
                    <button key={s.label} onClick={() => s.isStudio ? setCurrentView('studio') : handleSearch(s.label)} className="flex flex-col items-center gap-3 group" disabled={isLoading}>
                        <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl ${theme.bgSecondary} border ${theme.border} flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg transition-all`} style={{ boxShadow: `0 4px 20px ${s.color}20` }}>
                            <s.icon size={26} style={{ color: s.color }} />
                        </div>
                        <span className={`${theme.textSecondary} text-sm font-medium group-hover:text-cyan-500`}>{s.label}@</span>
                    </button>
                ))}
            </div>

            <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-8 max-w-lg text-center shadow-sm`}>
                <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
                        <Download size={24} className="text-cyan-600" />
                    </div>
                </div>
                <h3 className={`${theme.text} text-xl font-semibold mb-2`}>Get your @handle</h3>
                <p className={`${theme.textSecondary} mb-6`}>Download GNS Browser for iOS/Android to create your identity through Proof-of-Trajectory</p>
                <div className="flex gap-4 justify-center flex-wrap">
                    <button className={`px-5 py-3 ${theme.bgTertiary} ${theme.hover} rounded-xl ${theme.text} font-medium`}> App Store</button>
                    <button className={`px-5 py-3 ${theme.bgTertiary} ${theme.hover} rounded-xl ${theme.text} font-medium`}>🤖 Play Store</button>
                </div>
            </div>

            <div className={`mt-12 ${theme.textMuted} text-sm`}>Powered by GNS Protocol • Patent Pending #63/948,788</div>
        </div>
    );
};

// ==========================================
// PROFILE VIEW
// ==========================================
export const ProfileView = ({ profile, openMessageModal, copyToClipboard, copiedKey, fetchProfile }) => {
    const { theme, darkMode } = useTheme();
    const typeIcons = { person: User, organization: Building, landmark: MapPin, bot: Package };
    const TypeIcon = typeIcons[profile.type] || User;

    const renderAvatar = () => {
        if (profile.avatarUrl && profile.avatarUrl.startsWith('http')) {
            return <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover rounded-3xl" />;
        }
        return <span className="text-6xl">{profile.avatar || '👤'}</span>;
    };

    return (
        <div className={`min-h-full ${theme.bg}`}>
            <div className="h-48 relative" style={{ background: `linear-gradient(135deg, ${profile.color || '#0EA5E9'}40 0%, ${profile.color || '#0EA5E9'}10 100%)` }} />

            <div className="max-w-2xl mx-auto px-6 -mt-20 relative pb-12">
                <div className={`w-36 h-36 rounded-3xl ${theme.bgSecondary} border-4 ${darkMode ? 'border-gray-900' : 'border-gray-50'} shadow-xl flex items-center justify-center overflow-hidden mb-4`}>
                    {renderAvatar()}
                </div>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className={`text-3xl font-bold ${theme.text}`}>{profile.name}</h1>
                            {profile.stats?.verified && <span className="text-cyan-500 text-xl">✓</span>}
                        </div>
                        <p className="text-cyan-500 text-lg font-medium">@{profile.handle}</p>
                        <p className={`${theme.textSecondary} mt-1 flex items-center gap-2`}>
                            <TypeIcon size={16} />{profile.tagline || profile.type}
                        </p>
                    </div>
                    <button
                        onClick={() => openMessageModal(profile)}
                        className="px-6 py-3 rounded-full text-white font-medium shadow-lg self-start flex items-center gap-2 hover:shadow-xl transition-shadow"
                        style={{ backgroundColor: profile.color || '#0EA5E9' }}
                    >
                        <MessageCircle size={18} />
                        Message
                    </button>
                </div>

                {profile.bio && <p className={`${theme.text} text-lg leading-relaxed mb-6`}>{profile.bio}</p>}

                <div className={`flex gap-6 md:gap-8 mb-6 pb-6 border-b ${theme.border} flex-wrap`}>
                    {profile.stats?.trustScore && (
                        <div><span className={`${theme.text} font-bold text-lg`}>{profile.stats.trustScore}</span><span className={`${theme.textSecondary} ml-2`}>Trust Score</span></div>
                    )}
                    {profile.stats?.breadcrumbs && (
                        <div><span className={`${theme.text} font-bold text-lg`}>{profile.stats.breadcrumbs}</span><span className={`${theme.textSecondary} ml-2`}>Breadcrumbs</span></div>
                    )}
                </div>

                {profile.publicKey && (
                    <div className={`mb-6 p-4 ${theme.bgTertiary} rounded-xl`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`${theme.textSecondary} text-sm font-medium`}>Public Key</span>
                            <button onClick={() => copyToClipboard(profile.publicKey)} className={`flex items-center gap-1 text-sm ${theme.textSecondary} hover:text-cyan-500`}>
                                {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                                {copiedKey ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                        <code className={`${theme.text} text-xs font-mono break-all`}>{profile.publicKey}</code>
                    </div>
                )}

                {profile.links && profile.links.length > 0 && (
                    <div className="flex gap-4 flex-wrap mb-6">
                        {profile.links.map((link, i) => (
                            link.startsWith('@') ? (
                                <button key={i} onClick={() => fetchProfile(link)} className="text-cyan-500 hover:underline font-medium">{link}</button>
                            ) : (
                                <a key={i} href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline font-medium flex items-center gap-1">
                                    <ExternalLink size={14} />{link.replace(/^https?:\/\//, '')}
                                </a>
                            )
                        ))}
                    </div>
                )}

                <div className={`mt-8 p-6 ${theme.bgSecondary} rounded-2xl border ${theme.border}`}>
                    <h3 className={`${theme.textSecondary} text-sm font-semibold mb-4 uppercase tracking-wide`}>Facets</h3>
                    <div className="flex gap-3 flex-wrap">
                        {['work', 'friends', 'public'].map((f) => (
                            <button key={f} className={`px-5 py-3 ${theme.bgTertiary} ${theme.hover} rounded-xl ${theme.text} font-medium`}>{f}@{profile.handle}</button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// SEARCH RESULTS VIEW
// ==========================================
export const SearchResultsView = ({ searchResults, addressBar, fetchProfile, goHome }) => {
    const { theme } = useTheme();
    return (
        <div className={`min-h-full ${theme.bg} px-4 py-8`}>
            <div className="max-w-2xl mx-auto">
                <h2 className={`text-xl ${theme.text} font-semibold mb-6`}>
                    {searchResults.length > 0 ? `Results for "${addressBar}"` : `No results for "${addressBar}"`}
                </h2>
                {searchResults.length > 0 ? (
                    <div className="space-y-4">
                        {searchResults.map((r, i) => (
                            <button key={i} onClick={() => fetchProfile(r.handle)} className={`w-full p-4 ${theme.bgSecondary} border ${theme.border} rounded-xl flex items-center gap-4 ${theme.hover} text-left`}>
                                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-2xl">{r.avatar || '👤'}</div>
                                <div><div className={`${theme.text} font-semibold`}>{r.name}</div><div className="text-cyan-500">@{r.handle}</div></div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">🔍</div>
                        <p className={theme.textSecondary}>No identities found</p>
                        <button onClick={goHome} className="mt-6 px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white font-medium">Back to Search</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ==========================================
// NOT FOUND VIEW
// ==========================================
export const NotFoundView = ({ addressBar, error, goHome }) => {
    const { theme } = useTheme();
    return (
        <div className={`min-h-full ${theme.bg} flex flex-col items-center justify-center px-4`}>
            <div className="text-7xl mb-6">🔍</div>
            <h2 className={`text-2xl ${theme.text} font-semibold mb-2`}>No identity found for "{addressBar}"</h2>
            <p className={`${theme.textSecondary} mb-8`}>{error || "This @handle hasn't been claimed yet"}</p>
            <button onClick={goHome} className="px-8 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white font-medium shadow-lg">Back to Search</button>
        </div>
    );
};

// ==========================================
// LOADING VIEW
// ==========================================
export const LoadingView = () => {
    const { theme } = useTheme();
    return (
        <div className={`min-h-full ${theme.bg} flex flex-col items-center justify-center`}>
            <Loader2 size={48} className="text-cyan-500 animate-spin mb-4" />
            <p className={theme.textSecondary}>Loading identity...</p>
        </div>
    );
};
