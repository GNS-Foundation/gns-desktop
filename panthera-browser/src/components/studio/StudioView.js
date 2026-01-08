import React from 'react';
import { Sparkles, Star, Globe, User, Package, Building, ExternalLink, Menu } from 'lucide-react';
import GSiteEditorView from './GSiteEditorView';
import ProfileEditorView from './ProfileEditorView';
import FacetsManagerView from './FacetsManagerView';
import SettingsView from './SettingsView';

// ==========================================
// STUDIO COMPONENTS (Refactored)
// ==========================================

const StudioView = ({
    studioTool, setStudioTool, authUser, theme, darkMode, setDarkMode,
    gsiteData, setGsiteData, profileData, setProfileData, facets, setFacets, settingsData, setSettingsData
}) => {
    // If a tool is selected, show that tool's view
    if (studioTool === 'gsite') return <GSiteEditorView gsiteData={gsiteData} setGsiteData={setGsiteData} theme={theme} authUser={authUser} darkMode={darkMode} setStudioTool={setStudioTool} />;
    if (studioTool === 'profile') return <ProfileEditorView profileData={profileData} setProfileData={setProfileData} theme={theme} authUser={authUser} setStudioTool={setStudioTool} />;
    if (studioTool === 'facets') return <FacetsManagerView facets={facets} setFacets={setFacets} theme={theme} authUser={authUser} setStudioTool={setStudioTool} />;
    if (studioTool === 'settings') return <SettingsView settingsData={settingsData} setSettingsData={setSettingsData} theme={theme} darkMode={darkMode} setDarkMode={setDarkMode} setStudioTool={setStudioTool} />;

    // Otherwise show the dashboard
    return (
        <div className={`min-h-full ${theme.bg} py-8 px-4`}>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                            <Sparkles size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-bold ${theme.text}`}>
                                studio@{authUser?.handle || 'you'}
                            </h1>
                            <p className={`text-sm ${theme.textSecondary}`}>
                                Your Creative Space
                            </p>
                        </div>
                    </div>
                </div>

                {/* Pro Upgrade Banner */}
                <div className={`mb-8 p-4 rounded-xl bg-gradient-to-r ${darkMode ? 'from-amber-900/30 to-orange-900/30 border-amber-700' : 'from-amber-50 to-orange-50 border-amber-200'} border`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Star className="text-amber-500" size={24} />
                            <div>
                                <p className={`font-medium ${theme.text}`}>Upgrade to Pro</p>
                                <p className={`text-sm ${theme.textSecondary}`}>Get analytics, custom domains, and more</p>
                            </div>
                        </div>
                        <button className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-medium rounded-lg hover:from-amber-500 hover:to-orange-600 transition-colors">
                            Upgrade
                        </button>
                    </div>
                </div>

                {/* Tools Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* GSite Builder */}
                    <button
                        onClick={() => setStudioTool('gsite')}
                        className={`text-left p-6 rounded-2xl ${theme.bgSecondary} border ${theme.border} hover:border-cyan-500 hover:shadow-xl transition-all group`}
                    >
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Globe size={28} className="text-white" />
                        </div>
                        <h3 className={`text-lg font-semibold ${theme.text} mb-1`}>GSite Builder</h3>
                        <p className={`text-sm ${theme.textSecondary}`}>Create your professional page with blocks</p>
                    </button>

                    {/* Edit Profile */}
                    <button
                        onClick={() => setStudioTool('profile')}
                        className={`text-left p-6 rounded-2xl ${theme.bgSecondary} border ${theme.border} hover:border-purple-500 hover:shadow-xl transition-all group`}
                    >
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <User size={28} className="text-white" />
                        </div>
                        <h3 className={`text-lg font-semibold ${theme.text} mb-1`}>Edit Profile</h3>
                        <p className={`text-sm ${theme.textSecondary}`}>Photo, bio, display name, and more</p>
                    </button>

                    {/* Facets Manager */}
                    <button
                        onClick={() => setStudioTool('facets')}
                        className={`text-left p-6 rounded-2xl ${theme.bgSecondary} border ${theme.border} hover:border-green-500 hover:shadow-xl transition-all group`}
                    >
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Package size={28} className="text-white" />
                        </div>
                        <h3 className={`text-lg font-semibold ${theme.text} mb-1`}>Facets Manager</h3>
                        <p className={`text-sm ${theme.textSecondary}`}>Create work@, friends@, pro@ identities</p>
                    </button>

                    {/* Analytics (Pro) */}
                    <button className={`text-left p-6 rounded-2xl ${theme.bgSecondary} border ${theme.border} opacity-60 cursor-not-allowed relative`}>
                        <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-xs font-bold text-white">
                            <Star size={12} fill="white" />
                            PRO
                        </div>
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-4">
                            <Building size={28} className="text-white" />
                        </div>
                        <h3 className={`text-lg font-semibold ${theme.text} mb-1`}>Analytics</h3>
                        <p className={`text-sm ${theme.textSecondary}`}>Views, clicks, visitors, and trends</p>
                    </button>

                    {/* Custom Domains (Pro) */}
                    <button className={`text-left p-6 rounded-2xl ${theme.bgSecondary} border ${theme.border} opacity-60 cursor-not-allowed relative`}>
                        <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-xs font-bold text-white">
                            <Star size={12} fill="white" />
                            PRO
                        </div>
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mb-4">
                            <ExternalLink size={28} className="text-white" />
                        </div>
                        <h3 className={`text-lg font-semibold ${theme.text} mb-1`}>Custom Domains</h3>
                        <p className={`text-sm ${theme.textSecondary}`}>Connect yourname.com to your GSite</p>
                    </button>

                    {/* Settings */}
                    <button
                        onClick={() => setStudioTool('settings')}
                        className={`text-left p-6 rounded-2xl ${theme.bgSecondary} border ${theme.border} hover:border-gray-400 hover:shadow-xl transition-all group`}
                    >
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gray-500 to-slate-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Menu size={28} className="text-white" />
                        </div>
                        <h3 className={`text-lg font-semibold ${theme.text} mb-1`}>Settings</h3>
                        <p className={`text-sm ${theme.textSecondary}`}>Privacy, security, and preferences</p>
                    </button>
                </div>

                {/* Create GSite CTA */}
                <div className={`mt-8 rounded-xl border ${theme.border} ${theme.bgSecondary} p-6`}>
                    <div className="text-center py-8">
                        <Globe size={48} className={`mx-auto ${theme.textMuted} mb-4`} />
                        <p className={theme.textSecondary}>Create your GSite to start building your professional presence</p>
                        <button
                            onClick={() => setStudioTool('gsite')}
                            className="mt-4 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-400 hover:to-blue-400 transition-colors"
                        >
                            Create GSite
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudioView;
