import React, { useState } from 'react';
import { ArrowLeft, Camera, User, MapPin, Globe, AtSign } from 'lucide-react';

// ==========================================
// 2. PROFILE EDITOR VIEW
// ==========================================
const ProfileEditorView = ({ profileData, setProfileData, theme, authUser, setStudioTool }) => {
    const [localProfile, setLocalProfile] = useState(profileData || {
        displayName: authUser?.handle || '',
        bio: '',
        avatar: null,
        location: '',
        website: '',
    });
    const [hasChanges, setHasChanges] = useState(false);

    const updateField = (field, value) => {
        setLocalProfile(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    const handleSave = () => {
        setProfileData(localProfile);
        localStorage.setItem(`profile_${authUser?.handle}`, JSON.stringify(localProfile));
        setHasChanges(false);
        alert('Profile saved!');
    };

    return (
        <div className={`min-h-full ${theme.bg}`}>
            {/* Header */}
            <header className={`sticky top-0 z-40 ${theme.bgSecondary} border-b ${theme.border}`}>
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setStudioTool(null)} className={`p-2 ${theme.hover} rounded-lg`}>
                            <ArrowLeft size={20} className={theme.textSecondary} />
                        </button>
                        <div>
                            <h1 className={`font-semibold ${theme.text}`}>Edit Profile</h1>
                            <p className={`text-xs ${theme.textSecondary}`}>@{authUser?.handle}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className={`px-4 py-2 rounded-lg font-medium ${hasChanges
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                            : `${theme.bgTertiary} ${theme.textMuted} cursor-not-allowed`
                            }`}
                    >
                        Save Changes
                    </button>
                </div>
            </header>

            {/* Editor */}
            <div className="max-w-2xl mx-auto p-4 md:p-8">
                {/* Avatar Section */}
                <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6 mb-6`}>
                    <h3 className={`font-semibold ${theme.text} mb-4`}>Profile Photo</h3>
                    <div className="flex items-center gap-6">
                        <div className={`w-24 h-24 rounded-full ${theme.bgTertiary} border-2 ${theme.border} flex items-center justify-center overflow-hidden`}>
                            {localProfile.avatar ? (
                                <img src={localProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <User size={40} className={theme.textMuted} />
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium flex items-center gap-2">
                                <Camera size={18} />
                                Upload Photo
                            </button>
                            <p className={`text-xs ${theme.textSecondary}`}>JPG, PNG. Max 5MB</p>
                        </div>
                    </div>
                </div>

                {/* Basic Info */}
                <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6 mb-6`}>
                    <h3 className={`font-semibold ${theme.text} mb-4`}>Basic Information</h3>
                    <div className="space-y-4">
                        <div>
                            <label className={`text-sm font-medium ${theme.textSecondary} block mb-2`}>Display Name</label>
                            <input
                                type="text"
                                value={localProfile.displayName}
                                onChange={(e) => updateField('displayName', e.target.value)}
                                placeholder="Your name"
                                className={`w-full px-4 py-3 rounded-xl border ${theme.border} bg-transparent ${theme.text} focus:outline-none focus:border-purple-500`}
                            />
                        </div>
                        <div>
                            <label className={`text-sm font-medium ${theme.textSecondary} block mb-2`}>Bio</label>
                            <textarea
                                value={localProfile.bio}
                                onChange={(e) => updateField('bio', e.target.value)}
                                placeholder="Tell the world about yourself..."
                                rows={3}
                                className={`w-full px-4 py-3 rounded-xl border ${theme.border} bg-transparent ${theme.text} focus:outline-none focus:border-purple-500 resize-none`}
                            />
                            <p className={`text-xs ${theme.textSecondary} mt-1`}>{localProfile.bio.length}/160 characters</p>
                        </div>
                        <div>
                            <label className={`text-sm font-medium ${theme.textSecondary} block mb-2`}>Location</label>
                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${theme.border}`}>
                                <MapPin size={18} className={theme.textMuted} />
                                <input
                                    type="text"
                                    value={localProfile.location}
                                    onChange={(e) => updateField('location', e.target.value)}
                                    placeholder="City, Country"
                                    className={`flex-1 bg-transparent ${theme.text} focus:outline-none`}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={`text-sm font-medium ${theme.textSecondary} block mb-2`}>Website</label>
                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${theme.border}`}>
                                <Globe size={18} className={theme.textMuted} />
                                <input
                                    type="url"
                                    value={localProfile.website}
                                    onChange={(e) => updateField('website', e.target.value)}
                                    placeholder="https://yourwebsite.com"
                                    className={`flex-1 bg-transparent ${theme.text} focus:outline-none`}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* GNS Handle (Read-only) */}
                <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6`}>
                    <h3 className={`font-semibold ${theme.text} mb-4`}>GNS Identity</h3>
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${theme.bgTertiary}`}>
                        <AtSign size={18} className="text-cyan-500" />
                        <span className={`font-medium ${theme.text}`}>{authUser?.handle}</span>
                        <span className={`text-xs px-2 py-1 rounded-full bg-green-100 text-green-600`}>Verified</span>
                    </div>
                    <p className={`text-xs ${theme.textSecondary} mt-2`}>Your @handle is permanent and cryptographically linked to your identity</p>
                </div>
            </div>
        </div>
    );
};

export default ProfileEditorView;
