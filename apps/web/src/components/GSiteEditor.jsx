// ===========================================
// GSITE EDITOR - Block-based Page Builder
// 
// Location: panthera-browser/src/components/GSiteEditor.jsx
// ===========================================

import React, { useState, useCallback } from 'react';
import {
  ArrowLeft,
  Eye,
  Save,
  Upload,
  Undo,
  Redo,
  Smartphone,
  Monitor,
  Palette,
  Plus,
  GripVertical,
  Trash2,
  Settings,
  ChevronUp,
  ChevronDown,
  Check,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import BlockRenderer from './blocks/BlockRenderer';
import BlockPicker from './blocks/BlockPicker';
import StylePanel from './GSiteStylePanel';

// ===========================================
// DEFAULT GSITE DATA
// ===========================================

const defaultGSite = {
  blocks: [],
  style: {
    mood: 'cool',
    accent: 'blue',
    density: 'balanced',
  },
  title: '',
  description: '',
  published: false,
};

// ===========================================
// EDITOR HEADER
// ===========================================

function EditorHeader({ 
  title,
  onBack, 
  onPreview, 
  onSave, 
  onPublish,
  isSaving,
  isPublishing,
  hasChanges,
  isPublished,
  previewMode,
  setPreviewMode,
}) {
  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: Back + Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white">
              {title || 'Untitled GSite'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {hasChanges ? 'Unsaved changes' : isPublished ? 'Published' : 'Draft'}
            </p>
          </div>
        </div>

        {/* Center: Preview toggles */}
        <div className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setPreviewMode('desktop')}
            className={`p-2 rounded-md transition-colors ${
              previewMode === 'desktop' 
                ? 'bg-white dark:bg-gray-700 shadow-sm' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Monitor size={18} className={previewMode === 'desktop' ? 'text-cyan-500' : 'text-gray-500'} />
          </button>
          <button
            onClick={() => setPreviewMode('mobile')}
            className={`p-2 rounded-md transition-colors ${
              previewMode === 'mobile' 
                ? 'bg-white dark:bg-gray-700 shadow-sm' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Smartphone size={18} className={previewMode === 'mobile' ? 'text-cyan-500' : 'text-gray-500'} />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPreview}
            className="hidden sm:flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Eye size={18} />
            <span className="text-sm">Preview</span>
          </button>
          
          <button
            onClick={onSave}
            disabled={isSaving || !hasChanges}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              hasChanges
                ? 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            <span className="text-sm hidden sm:inline">Save</span>
          </button>

          <button
            onClick={onPublish}
            disabled={isPublishing}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-lg transition-colors"
          >
            {isPublishing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Upload size={18} />
            )}
            <span className="text-sm font-medium">Publish</span>
          </button>
        </div>
      </div>
    </header>
  );
}

// ===========================================
// BLOCK WRAPPER (with controls)
// ===========================================

function BlockWrapper({ 
  block, 
  index, 
  isSelected,
  onSelect,
  onMove,
  onDelete,
  onUpdate,
  totalBlocks,
  children 
}) {
  return (
    <div
      onClick={() => onSelect(block.id)}
      className={`
        group relative rounded-xl transition-all duration-200
        ${isSelected 
          ? 'ring-2 ring-cyan-500 ring-offset-2 dark:ring-offset-gray-900' 
          : 'hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600 hover:ring-offset-2 dark:hover:ring-offset-gray-900'
        }
      `}
    >
      {/* Drag Handle + Controls */}
      <div className={`
        absolute -left-12 top-1/2 -translate-y-1/2 flex flex-col gap-1
        opacity-0 group-hover:opacity-100 transition-opacity
      `}>
        <button className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 cursor-grab hover:bg-gray-50 dark:hover:bg-gray-700">
          <GripVertical size={16} className="text-gray-400" />
        </button>
      </div>

      {/* Right Controls */}
      <div className={`
        absolute -right-12 top-1/2 -translate-y-1/2 flex flex-col gap-1
        opacity-0 group-hover:opacity-100 transition-opacity
      `}>
        <button
          onClick={(e) => { e.stopPropagation(); onMove(index, 'up'); }}
          disabled={index === 0}
          className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30"
        >
          <ChevronUp size={16} className="text-gray-400" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMove(index, 'down'); }}
          disabled={index === totalBlocks - 1}
          className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30"
        >
          <ChevronDown size={16} className="text-gray-400" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(block.id); }}
          className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-300 dark:hover:border-red-800"
        >
          <Trash2 size={16} className="text-gray-400 hover:text-red-500" />
        </button>
      </div>

      {/* Block Content */}
      {children}
    </div>
  );
}

// ===========================================
// ADD BLOCK BUTTON
// ===========================================

function AddBlockButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="
        w-full py-8 border-2 border-dashed border-gray-300 dark:border-gray-700
        rounded-xl hover:border-cyan-400 dark:hover:border-cyan-600
        hover:bg-cyan-50 dark:hover:bg-cyan-900/20
        transition-colors group
      "
    >
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/50 flex items-center justify-center transition-colors">
          <Plus size={24} className="text-gray-400 group-hover:text-cyan-500" />
        </div>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
          Add Block
        </span>
      </div>
    </button>
  );
}

// ===========================================
// MAIN GSITE EDITOR
// ===========================================

export default function GSiteEditor({ 
  handle,
  initialData,
  onBack,
  onSave,
  onPublish,
  darkMode = false,
}) {
  // State
  const [gsite, setGSite] = useState(initialData || defaultGSite);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [previewMode, setPreviewMode] = useState('desktop');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Get selected block
  const selectedBlock = gsite.blocks.find(b => b.id === selectedBlockId);

  // ===========================================
  // BLOCK OPERATIONS
  // ===========================================

  const addBlock = useCallback((blockType, afterIndex = null) => {
    const newBlock = {
      id: `block_${Date.now()}`,
      type: blockType,
      ...getDefaultBlockData(blockType),
    };

    setGSite(prev => {
      const newBlocks = [...prev.blocks];
      if (afterIndex !== null) {
        newBlocks.splice(afterIndex + 1, 0, newBlock);
      } else {
        newBlocks.push(newBlock);
      }
      return { ...prev, blocks: newBlocks };
    });

    setSelectedBlockId(newBlock.id);
    setShowBlockPicker(false);
    setHasChanges(true);
  }, []);

  const updateBlock = useCallback((blockId, updates) => {
    setGSite(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => 
        b.id === blockId ? { ...b, ...updates } : b
      ),
    }));
    setHasChanges(true);
  }, []);

  const deleteBlock = useCallback((blockId) => {
    setGSite(prev => ({
      ...prev,
      blocks: prev.blocks.filter(b => b.id !== blockId),
    }));
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
    setHasChanges(true);
  }, [selectedBlockId]);

  const moveBlock = useCallback((index, direction) => {
    setGSite(prev => {
      const newBlocks = [...prev.blocks];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      
      if (newIndex < 0 || newIndex >= newBlocks.length) return prev;
      
      [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
      return { ...prev, blocks: newBlocks };
    });
    setHasChanges(true);
  }, []);

  // ===========================================
  // STYLE OPERATIONS
  // ===========================================

  const updateStyle = useCallback((styleUpdates) => {
    setGSite(prev => ({
      ...prev,
      style: { ...prev.style, ...styleUpdates },
    }));
    setHasChanges(true);
  }, []);

  // ===========================================
  // SAVE / PUBLISH
  // ===========================================

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage for now (later: API)
      localStorage.setItem(`gsite_draft_${handle}`, JSON.stringify(gsite));
      setHasChanges(false);
      // TODO: Call onSave prop
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      // TODO: Mobile signing flow
      // For now, just save
      await handleSave();
      setGSite(prev => ({ ...prev, published: true }));
      if (onPublish) {
        await onPublish(gsite);
      }
    } catch (error) {
      console.error('Publish failed:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  // ===========================================
  // RENDER
  // ===========================================

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {/* Header */}
      <EditorHeader
        title={gsite.title || `${handle}'s GSite`}
        onBack={onBack}
        onPreview={() => window.open(`/@${handle}/gsite`, '_blank')}
        onSave={handleSave}
        onPublish={handlePublish}
        isSaving={isSaving}
        isPublishing={isPublishing}
        hasChanges={hasChanges}
        isPublished={gsite.published}
        previewMode={previewMode}
        setPreviewMode={setPreviewMode}
      />

      {/* Main Layout */}
      <div className="flex">
        {/* Canvas */}
        <main className="flex-1 p-4 md:p-8">
          <div 
            className={`
              mx-auto transition-all duration-300
              ${previewMode === 'mobile' ? 'max-w-sm' : 'max-w-3xl'}
            `}
          >
            {/* GSite Preview Container */}
            <div className={`
              rounded-2xl shadow-xl overflow-hidden
              ${darkMode ? 'bg-gray-800' : 'bg-white'}
              ${previewMode === 'mobile' ? 'border-8 border-gray-800 rounded-[2.5rem]' : ''}
            `}>
              {/* Content */}
              <div className="p-6 md:p-8 space-y-6">
                {/* Blocks */}
                {gsite.blocks.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <Plus size={32} className="text-gray-400" />
                    </div>
                    <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Start building your GSite
                    </h3>
                    <p className={`text-sm mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Add blocks to create your professional page
                    </p>
                    <button
                      onClick={() => setShowBlockPicker(true)}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-400 hover:to-blue-400 transition-colors"
                    >
                      Add Your First Block
                    </button>
                  </div>
                ) : (
                  <>
                    {gsite.blocks.map((block, index) => (
                      <BlockWrapper
                        key={block.id}
                        block={block}
                        index={index}
                        isSelected={selectedBlockId === block.id}
                        onSelect={setSelectedBlockId}
                        onMove={moveBlock}
                        onDelete={deleteBlock}
                        onUpdate={updateBlock}
                        totalBlocks={gsite.blocks.length}
                      >
                        <BlockRenderer
                          block={block}
                          onUpdate={(updates) => updateBlock(block.id, updates)}
                          isEditing={selectedBlockId === block.id}
                          darkMode={darkMode}
                        />
                      </BlockWrapper>
                    ))}
                    
                    {/* Add Block Button */}
                    <AddBlockButton onClick={() => setShowBlockPicker(true)} />
                  </>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Sidebar (Style Panel) */}
        <aside className={`
          hidden lg:block w-80 border-l
          ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
        `}>
          <StylePanel
            style={gsite.style}
            onUpdateStyle={updateStyle}
            selectedBlock={selectedBlock}
            onUpdateBlock={(updates) => selectedBlock && updateBlock(selectedBlock.id, updates)}
            darkMode={darkMode}
          />
        </aside>
      </div>

      {/* Block Picker Modal */}
      {showBlockPicker && (
        <BlockPicker
          onSelect={addBlock}
          onClose={() => setShowBlockPicker(false)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}

// ===========================================
// HELPER: Default block data by type
// ===========================================

function getDefaultBlockData(type) {
  switch (type) {
    case 'text':
      return {
        variant: 'paragraph',
        content: '',
        align: 'left',
      };
    case 'media':
      return {
        variant: 'image',
        items: [],
        layout: 'single',
      };
    case 'link':
      return {
        url: '',
        style: 'card',
        customTitle: null,
        customDescription: null,
      };
    case 'list':
      return {
        variant: 'bullets',
        title: '',
        items: [],
      };
    case 'grid':
      return {
        title: '',
        columns: 3,
        items: [],
      };
    case 'event':
      return {
        title: '',
        date: null,
        location: null,
        link: '',
      };
    case 'price':
      return {
        title: 'Services',
        currency: 'USD',
        items: [],
      };
    case 'contact':
      return {
        items: [],
        showForm: false,
      };
    default:
      return {};
  }
}
