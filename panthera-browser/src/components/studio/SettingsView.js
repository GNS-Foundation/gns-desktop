import React, { useState } from 'react';
import { ArrowLeft, Palette, Bell, Lock, Shield, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// ==========================================
// 4. SETTINGS VIEW
// ==========================================
const SettingsView = ({ settingsData, setSettingsData, setStudioTool }) => {
    const { theme, darkMode, setDarkMode } = useTheme();
    const { signOut } = useAuth();
    const [localSettings, setLocalSettings] = useState(settingsData || {
        notifications: true,
        privateMode: false,
        theme: darkMode ? 'dark' : 'light',
        language: 'en',
    });

    const updateSetting = (key, value) => {
        setLocalSettings(prev => {
            const next = { ...prev, [key]: value };
            setSettingsData(next);
            return next;
        });

        if (key === 'theme') {
            setDarkMode(value === 'dark');
        }
    };

    const SettingToggle = ({ label, description, checked, onChange }) => (
        <div className={`flex items-center justify-between py-4 border-b ${theme.border} last:border-0`}>
            <div>
                <h4 className={`font-medium ${theme.text}`}>{label}</h4>
                <p className={`text-sm ${theme.textSecondary}`}>{description}</p>
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`w-12 h-7 rounded-full transition-colors ${checked ? 'bg-cyan-500' : theme.bgTertiary}`}
            >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
    );

    return (
        <div className={`min-h-full ${theme.bg}`}>
            {/* Header */}
            <header className={`sticky top-0 z-40 ${theme.bgSecondary} border-b ${theme.border}`}>
                <div className="flex items-center gap-4 px-4 py-3">
                    <button onClick={() => setStudioTool(null)} className={`p-2 ${theme.hover} rounded-lg`}>
                        <ArrowLeft size={20} className={theme.textSecondary} />
                    </button>
                    <div>
                        <h1 className={`font-semibold ${theme.text}`}>Settings</h1>
                        <p className={`text-xs ${theme.textSecondary}`}>Privacy, security, and preferences</p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="max-w-2xl mx-auto p-4 md:p-8">
                {/* Appearance */}
                <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Palette size={20} className="text-purple-500" />
                        <h3 className={`font-semibold ${theme.text}`}>Appearance</h3>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className={`text-sm ${theme.textSecondary} block mb-2`}>Theme</label>
                            <div className="flex gap-2">
                                {['light', 'dark', 'system'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => updateSetting('theme', t)}
                                        className={`px-4 py-2 rounded-lg capitalize ${localSettings.theme === t
                                            ? 'bg-cyan-500 text-white'
                                            : `${theme.bgTertiary} ${theme.text}`
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Bell size={20} className="text-orange-500" />
                        <h3 className={`font-semibold ${theme.text}`}>Notifications</h3>
                    </div>
                    <SettingToggle
                        label="Push Notifications"
                        description="Receive notifications for messages and updates"
                        checked={localSettings.notifications}
                        onChange={(v) => updateSetting('notifications', v)}
                    />
                </div>

                {/* Privacy */}
                <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Lock size={20} className="text-green-500" />
                        <h3 className={`font-semibold ${theme.text}`}>Privacy</h3>
                    </div>
                    <SettingToggle
                        label="Private Mode"
                        description="Hide your profile from public search"
                        checked={localSettings.privateMode}
                        onChange={(v) => updateSetting('privateMode', v)}
                    />
                </div>

                {/* Security */}
                <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6 mb-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <Shield size={20} className="text-cyan-500" />
                        <h3 className={`font-semibold ${theme.text}`}>Security</h3>
                    </div>
                    <div className="space-y-4">
                        <div className={`flex items-center justify-between py-3`}>
                            <div>
                                <h4 className={`font-medium ${theme.text}`}>Connected Devices</h4>
                                <p className={`text-sm ${theme.textSecondary}`}>Manage devices with access to your identity</p>
                            </div>
                            <button className={`px-4 py-2 ${theme.bgTertiary} ${theme.hover} rounded-lg ${theme.text}`}>
                                Manage
                            </button>
                        </div>
                        <div className={`flex items-center justify-between py-3 border-t ${theme.border}`}>
                            <div>
                                <h4 className={`font-medium ${theme.text}`}>Export Identity</h4>
                                <p className={`text-sm ${theme.textSecondary}`}>Download your GNS identity backup</p>
                            </div>
                            <button className={`px-4 py-2 ${theme.bgTertiary} ${theme.hover} rounded-lg ${theme.text}`}>
                                Export
                            </button>
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className={`border border-red-200 dark:border-red-800 rounded-2xl p-6`}>
                    <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle size={20} className="text-red-500" />
                        <h3 className={`font-semibold text-red-500`}>Danger Zone</h3>
                    </div>
                    <div className={`flex items-center justify-between`}>
                        <div>
                            <h4 className={`font-medium ${theme.text}`}>Sign Out Everywhere</h4>
                            <p className={`text-sm ${theme.textSecondary}`}>End all active sessions on all devices</p>
                        </div>
                        <button onClick={signOut} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg">
                            Sign Out All
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
