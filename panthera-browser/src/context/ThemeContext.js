import React, { createContext, useState, useContext } from 'react';

export const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    const [darkMode, setDarkMode] = useState(false);

    const theme = {
        bg: darkMode ? 'bg-gray-900' : 'bg-gray-50',
        bgSecondary: darkMode ? 'bg-gray-800' : 'bg-white',
        bgTertiary: darkMode ? 'bg-gray-700' : 'bg-gray-100',
        text: darkMode ? 'text-white' : 'text-gray-900',
        textSecondary: darkMode ? 'text-gray-400' : 'text-gray-600',
        textMuted: darkMode ? 'text-gray-500' : 'text-gray-400',
        border: darkMode ? 'border-gray-700' : 'border-gray-200',
        hover: darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100',
        isDark: darkMode,
    };

    return (
        <ThemeContext.Provider value={{ theme, darkMode, setDarkMode }}>
            {children}
        </ThemeContext.Provider>
    );
};
