import React, { useState, useRef } from 'react';
import { Type, Image, Link2, List, X, ChevronUp, ChevronDown, Trash2, ArrowLeft, Save, Eye, Globe, Plus } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// ==========================================
// 1. GSITE EDITOR VIEW
// ==========================================
const GSiteEditorView = ({ gsiteData, setGsiteData, setStudioTool }) => {
    const { theme, darkMode } = useTheme();
    const { authUser } = useAuth();
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [showBlockPicker, setShowBlockPicker] = useState(false);
    const [previewMode, setPreviewMode] = useState('desktop');
    const [hasChanges, setHasChanges] = useState(false);
    const fileInputRef = useRef(null);

    const blockTypes = [
        { type: 'text', icon: Type, label: 'Text', description: 'Heading, paragraph, or quote', color: 'blue' },
        { type: 'media', icon: Image, label: 'Media', description: 'Image, gallery, or video', color: 'purple' },
        { type: 'link', icon: Link2, label: 'Link', description: 'Smart link with preview', color: 'cyan' },
        { type: 'list', icon: List, label: 'List', description: 'Skills, services, features', color: 'green' },
    ];

    const addBlock = (type) => {
        const newBlock = {
            id: `block_${Date.now()}`,
            type,
            content: type === 'text' ? '' : type === 'list' ? [] : null,
            variant: type === 'text' ? 'paragraph' : 'default',
        };
        setGsiteData(prev => ({
            ...prev,
            blocks: [...prev.blocks, newBlock],
        }));
        setSelectedBlock(newBlock.id);
        setShowBlockPicker(false);
        setHasChanges(true);
    };

    const updateBlock = (blockId, updates) => {
        setGsiteData(prev => ({
            ...prev,
            blocks: prev.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b),
        }));
        setHasChanges(true);
    };

    const deleteBlock = (blockId) => {
        setGsiteData(prev => ({
            ...prev,
            blocks: prev.blocks.filter(b => b.id !== blockId),
        }));
        if (selectedBlock === blockId) setSelectedBlock(null);
        setHasChanges(true);
    };

    const moveBlock = (index, direction) => {
        setGsiteData(prev => {
            const newBlocks = [...prev.blocks];
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= newBlocks.length) return prev;
            [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
            return { ...prev, blocks: newBlocks };
        });
        setHasChanges(true);
    };

    const handleSave = () => {
        localStorage.setItem(`gsite_${authUser?.handle}`, JSON.stringify(gsiteData));
        setHasChanges(false);
        alert('GSite saved to draft!');
    };

    const handlePublish = () => {
        // TODO: Mobile signing flow
        alert('Publishing requires mobile app approval. Coming soon!');
    };

    const handleImageUploadClick = (blockId) => {
        setSelectedBlock(blockId);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && selectedBlock) {
            // Size validation (limit to 2MB for localStorage sake)
            if (file.size > 2 * 1024 * 1024) {
                alert('Image too large! Please choose an image under 2MB.');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                updateBlock(selectedBlock, { content: e.target.result });
            };
            reader.readAsDataURL(file);
        }
        // Reset input
        e.target.value = '';
    };

    // Block Picker Modal
    const BlockPickerModal = () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowBlockPicker(false)} />
            <div className={`relative w-full max-w-md rounded-2xl shadow-2xl ${theme.bgSecondary} p-6`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-semibold ${theme.text}`}>Add Block</h3>
                    <button onClick={() => setShowBlockPicker(false)} className={`p-2 rounded-lg ${theme.hover}`}>
                        <X size={20} className={theme.textSecondary} />
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {blockTypes.map(block => (
                        <button
                            key={block.type}
                            onClick={() => addBlock(block.type)}
                            className={`p-4 rounded-xl border ${theme.border} ${theme.hover} text-left transition-all hover:shadow-md`}
                        >
                            <block.icon size={24} className="text-cyan-500 mb-2" />
                            <h4 className={`font-medium ${theme.text}`}>{block.label}</h4>
                            <p className={`text-xs ${theme.textSecondary}`}>{block.description}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    // Render a block
    const renderBlock = (block, index) => {
        const isSelected = selectedBlock === block.id;

        return (
            <div
                key={block.id}
                onClick={() => setSelectedBlock(block.id)}
                className={`group relative p-4 rounded-xl transition-all ${isSelected
                    ? 'ring-2 ring-cyan-500 ring-offset-2'
                    : `${theme.hover} hover:ring-2 hover:ring-gray-300`
                    } ${darkMode ? 'ring-offset-gray-900' : 'ring-offset-white'}`}
            >
                {/* Block Controls */}
                <div className={`absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                    <button
                        onClick={(e) => { e.stopPropagation(); moveBlock(index, 'up'); }}
                        disabled={index === 0}
                        className={`p-1.5 rounded-lg ${theme.bgSecondary} border ${theme.border} shadow-sm disabled:opacity-30`}
                    >
                        <ChevronUp size={14} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); moveBlock(index, 'down'); }}
                        disabled={index === gsiteData.blocks.length - 1}
                        className={`p-1.5 rounded-lg ${theme.bgSecondary} border ${theme.border} shadow-sm disabled:opacity-30`}
                    >
                        <ChevronDown size={14} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                        className={`p-1.5 rounded-lg ${theme.bgSecondary} border ${theme.border} shadow-sm hover:bg-red-100 hover:border-red-300 hover:text-red-500`}
                    >
                        <Trash2 size={14} />
                    </button>
                </div>

                {/* Block Content */}
                {block.type === 'text' && (
                    <textarea
                        value={block.content || ''}
                        onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                        placeholder={block.variant === 'heading' ? 'Enter heading...' : 'Write your content...'}
                        className={`w-full bg-transparent resize-none focus:outline-none ${block.variant === 'heading'
                            ? `text-2xl font-bold ${theme.text}`
                            : `${theme.text}`
                            }`}
                        rows={block.variant === 'heading' ? 1 : 3}
                    />
                )}

                {block.type === 'media' && (
                    <div
                        onClick={() => handleImageUploadClick(block.id)}
                        className={`border-2 border-dashed ${theme.border} rounded-xl p-8 text-center cursor-pointer ${theme.hover} transition-colors`}
                    >
                        {block.content ? (
                            <img src={block.content} alt="Content" className="max-w-full h-auto rounded-lg mx-auto" />
                        ) : (
                            <>
                                <Image size={32} className={`mx-auto ${theme.textMuted} mb-2`} />
                                <p className={theme.textSecondary}>Click to upload image</p>
                            </>
                        )}
                    </div>
                )}

                {block.type === 'link' && (
                    <input
                        type="url"
                        value={block.content || ''}
                        onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                        placeholder="Paste a URL..."
                        className={`w-full p-3 rounded-lg border ${theme.border} bg-transparent ${theme.text} focus:outline-none focus:border-cyan-500`}
                    />
                )}

                {block.type === 'list' && (
                    <div className="space-y-2">
                        {(block.content || []).map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span className="text-cyan-500">•</span>
                                <input
                                    type="text"
                                    value={item}
                                    onChange={(e) => {
                                        const newItems = [...(block.content || [])];
                                        newItems[i] = e.target.value;
                                        updateBlock(block.id, { content: newItems });
                                    }}
                                    className={`flex-1 bg-transparent ${theme.text} focus:outline-none`}
                                    placeholder="List item..."
                                />
                            </div>
                        ))}
                        <button
                            onClick={() => updateBlock(block.id, { content: [...(block.content || []), ''] })}
                            className={`text-sm ${theme.textSecondary} hover:text-cyan-500 flex items-center gap-1`}
                        >
                            <Plus size={14} /> Add item
                        </button>
                    </div>
                )}
            </div>
        );
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
                            <h1 className={`font-semibold ${theme.text}`}>GSite Builder</h1>
                            <p className={`text-xs ${theme.textSecondary}`}>
                                {hasChanges ? 'Unsaved changes' : gsiteData.published ? 'Published' : 'Draft'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${hasChanges ? `${theme.bgTertiary} ${theme.hover}` : 'opacity-50 cursor-not-allowed'
                                } ${theme.text}`}
                        >
                            <Save size={18} />
                            <span className="text-sm hidden sm:inline">Save</span>
                        </button>
                        <button
                            onClick={handlePublish}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-400 hover:to-blue-400"
                        >
                            <Eye size={18} />
                            <span className="text-sm font-medium">Publish</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Editor */}
            <div className="max-w-3xl mx-auto p-4 md:p-8">
                <div className={`rounded-2xl ${theme.bgSecondary} border ${theme.border} shadow-sm overflow-hidden`}>
                    <div className="p-6 md:p-8 space-y-4">
                        {/* Title */}
                        <input
                            type="text"
                            value={gsiteData.title}
                            onChange={(e) => { setGsiteData(prev => ({ ...prev, title: e.target.value })); setHasChanges(true); }}
                            placeholder="Your GSite title..."
                            className={`w-full text-2xl font-bold bg-transparent ${theme.text} focus:outline-none`}
                        />

                        {/* Blocks */}
                        {gsiteData.blocks.length === 0 ? (
                            <div className="text-center py-12">
                                <Globe size={48} className={`mx-auto ${theme.textMuted} mb-4`} />
                                <h3 className={`text-lg font-medium ${theme.text} mb-2`}>Start building your GSite</h3>
                                <p className={`${theme.textSecondary} mb-6`}>Add blocks to create your professional page</p>
                                <button
                                    onClick={() => setShowBlockPicker(true)}
                                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl"
                                >
                                    Add Your First Block
                                </button>
                            </div>
                        ) : (
                            <>
                                {gsiteData.blocks.map((block, index) => renderBlock(block, index))}
                                <button
                                    onClick={() => setShowBlockPicker(true)}
                                    className={`w-full py-6 border-2 border-dashed ${theme.border} rounded-xl hover:border-cyan-500 hover:bg-cyan-50/10 transition-colors group`}
                                >
                                    <Plus size={24} className={`mx-auto ${theme.textMuted} group-hover:text-cyan-500`} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {showBlockPicker && <BlockPickerModal />}
            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
            />
        </div>
    );
};

export default GSiteEditorView;
