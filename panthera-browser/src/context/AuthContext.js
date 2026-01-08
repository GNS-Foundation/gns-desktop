import React, { createContext, useState, useContext, useEffect } from 'react';
import { getSession, signOut as authSignOut, isAuthenticated } from '../auth';
import wsService from '../websocket';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [authUser, setAuthUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize auth state
    useEffect(() => {
        const initAuth = () => {
            const session = getSession();
            if (session && isAuthenticated()) {
                console.log('✅ Session restored from localStorage');
                setAuthUser({
                    handle: session.handle || session.publicKey?.substring(0, 8) || 'user',
                    publicKey: session.publicKey,
                    displayName: session.displayName, // if available
                });
                // We'll let App.js handle the WebSocket connection for now to keep context focused on user state
                // or we could move it here if we want to fully decouple.
                // For now, let's keep it simple: just state.
            }
            setIsLoading(false);
        };
        initAuth();
    }, []);

    const signIn = (session) => {
        setAuthUser({
            handle: session.handle || session.publicKey?.substring(0, 8),
            publicKey: session.publicKey,
            displayName: session.displayName,
        });
    };

    const signOut = () => {
        authSignOut();
        wsService.disconnect();
        setAuthUser(null);
    };

    const updateProfile = (updates) => {
        setAuthUser(prev => ({ ...prev, ...updates }));
    };

    return (
        <AuthContext.Provider value={{ authUser, setAuthUser, signIn, signOut, updateProfile, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};
