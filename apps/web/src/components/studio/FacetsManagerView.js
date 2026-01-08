import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Package } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// ==========================================
// 3. FACETS MANAGER VIEW
// ==========================================
const FacetsManagerView = ({ facets, setFacets, setStudioTool }) => {
    const { theme } = useTheme();
    const { authUser } = useAuth();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newFacetName, setNewFacetName] = useState('');
    // Initialize with props or default
    const [localFacets, setLocalFacets] = useState(facets && facets.length > 0 ? facets : [
        { id: 'public', name: 'public', description: 'Default public facet', isDefault: true, contacts: 0 },
    ]);

    // Sync back to parent when localFacets changes
    useEffect(() => {
        setFacets(localFacets);
    }, [localFacets, setFacets]);

    const createFacet = () => {
        if (!newFacetName.trim()) return;
        const newFacet = {
            id: `facet_${Date.now()}`,
            name: newFacetName.toLowerCase().replace(/\s+/g, '_'),
            description: '',
            isDefault: false,
            contacts: 0,
        };
        setLocalFacets(prev => [...prev, newFacet]);
        setNewFacetName('');
        setShowCreateModal(false);
    };

    const deleteFacet = (id) => {
        if (localFacets.find(f => f.id === id)?.isDefault) {
            alert('Cannot delete default facet');
            return;
        }
        setLocalFacets(prev => prev.filter(f => f.id !== id));
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
                            <h1 className={`font-semibold ${theme.text}`}>Facets Manager</h1>
                            <p className={`text-xs ${theme.textSecondary}`}>Manage your identity facets</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium flex items-center gap-2"
                    >
                        <Plus size={18} />
                        New Facet
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="max-w-2xl mx-auto p-4 md:p-8">
                {/* Explanation */}
                <div className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6 mb-6`}>
                    <h3 className={`font-semibold ${theme.text} mb-2`}>What are Facets?</h3>
                    <p className={`${theme.textSecondary} text-sm`}>
                        Facets let you share different aspects of your identity with different people.
                        Create a <span className="text-green-500 font-medium">work@</span> facet for professional contacts,
                        a <span className="text-purple-500 font-medium">friends@</span> facet for personal connections,
                        or a <span className="text-cyan-500 font-medium">pro@</span> facet for your premium content.
                    </p>
                </div>

                {/* Facets List */}
                <div className="space-y-4">
                    {localFacets.map(facet => (
                        <div key={facet.id} className={`${theme.bgSecondary} border ${theme.border} rounded-2xl p-6`}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl ${facet.isDefault ? 'bg-cyan-500' : 'bg-green-500'} flex items-center justify-center`}>
                                        <Package size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className={`font-semibold ${theme.text}`}>{facet.name}@{authUser?.handle}</h3>
                                            {facet.isDefault && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-600">Default</span>
                                            )}
                                        </div>
                                        <p className={`text-sm ${theme.textSecondary}`}>{facet.contacts} contacts</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className={`p-2 ${theme.hover} rounded-lg`}>
                                        <Edit2 size={18} className={theme.textSecondary} />
                                    </button>
                                    {!facet.isDefault && (
                                        <button
                                            onClick={() => deleteFacet(facet.id)}
                                            className={`p-2 ${theme.hover} rounded-lg hover:text-red-500`}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
                    <div className={`relative w-full max-w-md rounded-2xl shadow-2xl ${theme.bgSecondary} p-6`}>
                        <h3 className={`text-lg font-semibold ${theme.text} mb-4`}>Create New Facet</h3>
                        <div className="mb-4">
                            <label className={`text-sm ${theme.textSecondary} block mb-2`}>Facet Name</label>
                            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${theme.border}`}>
                                <input
                                    type="text"
                                    value={newFacetName}
                                    onChange={(e) => setNewFacetName(e.target.value)}
                                    placeholder="work, friends, pro..."
                                    className={`flex-1 bg-transparent ${theme.text} focus:outline-none`}
                                />
                                <span className={theme.textSecondary}>@{authUser?.handle}</span>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className={`flex-1 px-4 py-2 ${theme.bgTertiary} ${theme.hover} rounded-lg ${theme.text}`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createFacet}
                                disabled={!newFacetName.trim()}
                                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium disabled:opacity-50"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FacetsManagerView;
