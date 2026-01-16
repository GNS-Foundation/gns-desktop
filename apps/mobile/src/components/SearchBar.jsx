import React, { useState } from 'react';
import './SearchBar.css';

export function SearchBar({ onSearch }) {
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        try {
            setSearching(true);
            await onSearch(query.trim());
        } finally {
            setSearching(false);
        }
    };

    return (
        <form className="search-bar" onSubmit={handleSubmit}>
            <div className="search-input-container">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search @handles..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={searching}
                />
                {searching && <span className="loading-spinner">⏳</span>}
            </div>
        </form>
    );
}
