// ===========================================
// GNS BROWSER - FACET EDITOR COMPONENT
// ===========================================

import { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Camera } from 'lucide-react';
import {
  ProfileFacet,
  ProfileLink,
  FacetType,
  FACET_EMOJIS,
  canDeleteFacet,
} from '../../types/profile';
import {
  saveLocalFacet,
  deleteLocalFacet,
  setDefaultFacetId,
  facetExists,
  syncProfileToNetwork,
} from '../../lib/profile';
import { AvatarPicker } from './AvatarPicker';
import { LinkEditor } from './LinkEditor';

interface FacetEditorProps {
  facet?: ProfileFacet;
  isNew?: boolean;
  isFromTemplate?: boolean;
  onSave: () => void;
  onClose: () => void;
}

export function FacetEditor({
  facet,
  isNew = false,
  isFromTemplate = false,
  onSave,
  onClose
}: FacetEditorProps) {
  const isEditing = facet && !isNew && !isFromTemplate;

  // Form state
  const [id, setId] = useState(facet?.id || '');
  const [label, setLabel] = useState(facet?.label || '');
  const [emoji, setEmoji] = useState(facet?.emoji || '👤');
  const [displayName, setDisplayName] = useState(facet?.displayName || '');
  const [bio, setBio] = useState(facet?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(facet?.avatarUrl);
  const [links, setLinks] = useState<ProfileLink[]>(facet?.links || []);
  const [isDefault, setIsDefault] = useState(facet?.isDefault || false);
  const [facetType] = useState<FacetType>(facet?.type || 'custom');

  // UI state
  const [saving, setSaving] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate ID from label (for new facets)
  useEffect(() => {
    if (isNew && !isFromTemplate && label) {
      const generatedId = label.toLowerCase().replace(/[^a-z0-9]/g, '');
      setId(generatedId);
    }
  }, [label, isNew, isFromTemplate]);

  const handleSave = async () => {
    // Validation
    if (!id.trim()) {
      setError('Facet ID is required');
      return;
    }
    if (!label.trim()) {
      setError('Label is required');
      return;
    }
    if (isNew && !isFromTemplate && facetExists(id)) {
      setError(`Facet "${id}" already exists`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const facetData: ProfileFacet = {
        id: isEditing ? facet!.id : id.toLowerCase().trim(),
        label: label.trim(),
        emoji,
        displayName: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
        avatarUrl,
        links,
        type: facetType,
        isDefault,
        createdAt: facet?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save locally
      saveLocalFacet(facetData);

      // Set as default if requested
      if (isDefault) {
        setDefaultFacetId(facetData.id);
      }

      // Sync to network for default facet
      const isDefaultFacet = isDefault || facetData.id === 'me' || facetData.type === 'defaultPersonal';
      if (isDefaultFacet) {
        console.log('📤 Syncing default facet to network...');
        const syncResult = await syncProfileToNetwork(facetData);
        if (syncResult.success) {
          console.log('✅ Profile synced to network!');
        } else {
          console.warn('⚠️ Profile sync failed:', syncResult.error);
        }
      }

      onSave();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!facet || !canDeleteFacet(facet)) return;

    deleteLocalFacet(facet.id);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#21262D]">
        <button onClick={onClose} className="p-2 -ml-2 hover:bg-[#21262D] rounded-lg">
          <ArrowLeft size={24} className="text-gray-400" />
        </button>
        <h1 className="text-lg font-semibold text-white">
          {isEditing ? 'Edit Facet' : 'New Facet'}
        </h1>
        <div className="flex items-center gap-2">
          {isEditing && facet && canDeleteFacet(facet) && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 hover:bg-red-500/20 rounded-lg"
            >
              <Trash2 size={20} className="text-red-400" />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Avatar Section */}
        <div className="bg-[#161B22] rounded-xl p-6">
          <div className="flex flex-col items-center">
            <button
              onClick={() => setShowAvatarPicker(true)}
              className="relative group"
            >
              <div className="w-24 h-24 rounded-full bg-[#21262D] flex items-center justify-center overflow-hidden border-4 border-[#30363D] group-hover:border-blue-500 transition-colors">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-5xl">{emoji}</span>
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-[#161B22]">
                <Camera size={14} className="text-white" />
              </div>
            </button>
            <p className="text-gray-500 text-sm mt-2">Tap to change photo</p>
          </div>

          {/* Emoji Picker */}
          <div className="mt-6">
            <label className="block text-gray-400 text-sm mb-2">Facet Emoji</label>
            <div className="flex flex-wrap gap-2 justify-center">
              {FACET_EMOJIS.slice(0, 10).map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl transition-colors ${emoji === e
                    ? 'bg-blue-500 border-2 border-blue-400'
                    : 'bg-[#21262D] border-2 border-transparent hover:border-[#30363D]'
                    }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Basic Info Section */}
        <div className="bg-[#161B22] rounded-xl p-6 space-y-4">
          {/* Facet ID */}
          {(isNew || isFromTemplate) && (
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                Facet ID <span className="text-gray-600">(lowercase, no spaces)</span>
              </label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                placeholder="work"
                disabled={isFromTemplate}
                className="w-full bg-[#21262D] text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 placeholder-gray-500"
              />
            </div>
          )}

          {/* Label */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Work"
              className="w-full bg-[#21262D] text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name on this facet"
              className="w-full bg-[#21262D] text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Bio Section */}
        <div className="bg-[#161B22] rounded-xl p-6">
          <label className="block text-gray-400 text-sm mb-2">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself..."
            rows={3}
            className="w-full bg-[#21262D] text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder-gray-500"
          />
        </div>

        {/* Links Section */}
        <div className="bg-[#161B22] rounded-xl p-6">
          <label className="block text-gray-400 text-sm mb-3">Links</label>
          <LinkEditor links={links} onLinksChange={setLinks} />
        </div>

        {/* Default Toggle */}
        {facetType !== 'broadcast' && facetType !== 'system' && (
          <div className="bg-[#161B22] rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">Set as Default</div>
                <div className="text-gray-500 text-sm">Use this facet when sharing your identity</div>
              </div>
              <button
                onClick={() => setIsDefault(!isDefault)}
                className={`w-12 h-7 rounded-full transition-colors ${isDefault ? 'bg-green-500' : 'bg-[#21262D]'
                  }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${isDefault ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Delete Button (for deletable facets) */}
        {isEditing && facet && canDeleteFacet(facet) && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-4 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors"
          >
            Delete Facet
          </button>
        )}
      </div>

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <AvatarPicker
          currentAvatar={avatarUrl}
          currentEmoji={emoji}
          onAvatarChange={setAvatarUrl}
          onEmojiChange={setEmoji}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161B22] w-full max-w-sm rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Facet?</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete "{label}"? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-[#21262D] text-gray-400 rounded-lg hover:bg-[#30363D] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FacetEditor;
