// ===========================================
// GNS BROWSER - LINK EDITOR COMPONENT
// ===========================================

import React, { useState } from 'react';
import { X, Link, Globe, Github, Twitter, Linkedin, Plus, Trash2 } from 'lucide-react';
import { ProfileLink, LINK_ICONS } from '../../types/profile';
import { normalizeUrl, detectLinkType, getLinkPlaceholder } from '../../lib/profile';

interface LinkEditorProps {
  links: ProfileLink[];
  onLinksChange: (links: ProfileLink[]) => void;
}

export function LinkEditor({ links, onLinksChange }: LinkEditorProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  const handleRemove = (index: number) => {
    const updated = links.filter((_, i) => i !== index);
    onLinksChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Existing Links */}
      {links.map((link, index) => (
        <div 
          key={index}
          className="flex items-center gap-3 bg-[#21262D] rounded-lg p-3"
        >
          <span className="text-xl">{LINK_ICONS[link.type] || '🔗'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-400 capitalize">{link.type}</div>
            <div className="text-white truncate">{link.url}</div>
          </div>
          <button
            onClick={() => handleRemove(index)}
            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
          >
            <Trash2 size={18} className="text-red-400" />
          </button>
        </div>
      ))}

      {/* Add Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-[#30363D] rounded-lg text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
      >
        <Plus size={18} />
        <span>Add Link</span>
      </button>

      {/* Add Link Modal */}
      {showAddModal && (
        <AddLinkModal
          onAdd={(link) => {
            onLinksChange([...links, link]);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

// ===========================================
// ADD LINK MODAL
// ===========================================

interface AddLinkModalProps {
  onAdd: (link: ProfileLink) => void;
  onClose: () => void;
}

function AddLinkModal({ onAdd, onClose }: AddLinkModalProps) {
  const [linkType, setLinkType] = useState<ProfileLink['type']>('website');
  const [url, setUrl] = useState('');

  const linkTypes: { type: ProfileLink['type']; label: string; icon: React.ReactNode }[] = [
    { type: 'website', label: 'Website', icon: <Globe size={18} /> },
    { type: 'twitter', label: 'Twitter', icon: <Twitter size={18} /> },
    { type: 'linkedin', label: 'LinkedIn', icon: <Linkedin size={18} /> },
    { type: 'github', label: 'GitHub', icon: <Github size={18} /> },
  ];

  const handleSubmit = () => {
    if (!url.trim()) return;
    
    const normalizedUrl = normalizeUrl(url.trim());
    const detectedType = detectLinkType(normalizedUrl);
    
    onAdd({
      type: linkType === 'website' ? detectedType : linkType,
      url: normalizedUrl,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161B22] w-full max-w-md rounded-2xl p-6 animate-scale-in">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-white">Add Link</h3>
          <button onClick={onClose} className="p-2 hover:bg-[#21262D] rounded-full">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Link Type Selector */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Type</label>
          <div className="flex flex-wrap gap-2">
            {linkTypes.map(({ type, label, icon }) => (
              <button
                key={type}
                onClick={() => setLinkType(type)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  linkType === type
                    ? 'bg-blue-500 text-white'
                    : 'bg-[#21262D] text-gray-400 hover:bg-[#30363D]'
                }`}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* URL Input */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">URL</label>
          <div className="flex items-center gap-2 bg-[#21262D] rounded-lg px-4 py-3">
            <Link size={18} className="text-gray-500" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={getLinkPlaceholder(linkType)}
              className="flex-1 bg-transparent text-white outline-none placeholder-gray-500"
              autoFocus
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-[#21262D] text-gray-400 rounded-lg hover:bg-[#30363D] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!url.trim()}
            className="flex-1 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Link
          </button>
        </div>
      </div>
    </div>
  );
}

export default LinkEditor;
