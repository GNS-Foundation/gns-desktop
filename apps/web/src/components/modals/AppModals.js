import React, { useRef } from 'react';
import { X, User, Smartphone, Loader2, Send } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

// ==========================================
// SIGN IN MODAL
// ==========================================
export const SignInModal = ({ setShowSignIn, setShowQRLogin }) => {
    const { theme } = useTheme();
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowSignIn(false)}>
            <div className={`${theme.bgSecondary} rounded-3xl p-8 max-w-sm w-full shadow-2xl relative border ${theme.border}`} onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowSignIn(false)} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full">
                    <X size={20} className={theme.textMuted} />
                </button>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User size={32} className="text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <h2 className={`text-2xl font-bold ${theme.text}`}>Welcome Back</h2>
                    <p className={theme.textSecondary}>Sign in to access your digital identity</p>
                </div>

                <button
                    onClick={() => {
                        setShowSignIn(false);
                        setShowQRLogin(true);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-400 hover:to-blue-400 transition-all flex items-center justify-center gap-2 mb-4"
                >
                    <Smartphone size={20} />
                    Sign in with Mobile App
                </button>

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className={`w-full border-t ${theme.border}`}></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className={`px-2 ${theme.bgSecondary} ${theme.textMuted}`}>Or continue as guest</span>
                    </div>
                </div>

                <button
                    onClick={() => setShowSignIn(false)}
                    className={`w-full py-3 border ${theme.border} ${theme.text} font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all`}
                >
                    Continue Browsing
                </button>
            </div>
        </div>
    );
};

// ==========================================
// MESSAGE MODAL
// ==========================================
export const MessageModal = ({ setShowMessageModal, recipientName, onSend, sendingMessage }) => {
    const { theme } = useTheme();
    const localMessageRef = useRef(null);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`${theme.bgSecondary} rounded-2xl w-full max-w-md p-6 shadow-2xl`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-lg font-bold ${theme.text}`}>Send Message</h3>
                    <button onClick={() => setShowMessageModal(false)}>
                        <X className={theme.text} />
                    </button>
                </div>
                <div className="mb-4">
                    <p className={`text-sm ${theme.textMuted} mb-2`}>To: <span className="font-semibold text-cyan-500">@{recipientName}</span></p>
                    <textarea
                        ref={localMessageRef}
                        className={`w-full h-32 p-3 rounded-lg ${theme.bg} ${theme.text} border ${theme.border} resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                        placeholder="Type your message..."
                    ></textarea>
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setShowMessageModal(false)} className={`px-4 py-2 rounded-lg ${theme.textSecondary} hover:bg-gray-100`}>
                        Cancel
                    </button>
                    <button
                        onClick={() => onSend(localMessageRef.current.value)}
                        disabled={sendingMessage}
                        className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-medium hover:from-cyan-400 hover:to-blue-400 flex items-center gap-2"
                    >
                        {sendingMessage ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};
