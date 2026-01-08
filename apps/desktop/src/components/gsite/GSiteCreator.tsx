// ===========================================
// GNS BROWSER - GSITE CREATOR
// ===========================================
// Create and edit your gSite profile

import React, { useState } from 'react';
import {
  ArrowLeft,
  Save,
  Camera,
  Plus,
  Trash2,
  Image as ImageIcon,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  GSite,
  PersonGSite,
  BusinessGSite,
  GSiteType,
  Link as GSiteLink,
  DEFAULT_ACTIONS,
} from '../../types/gsite';
import { saveGSite, validateGSite, ValidationError, getLocalGSite } from '../../lib/gsite';
import { fileToBase64, resizeImage } from '../../lib/profile';

// ===========================================
// MAIN CREATOR COMPONENT
// ===========================================

interface GSiteCreatorProps {
  handle: string;
  existingGSite?: GSite;
  onSave?: (gsite: GSite) => void;
  onBack?: () => void;
}

export function GSiteCreator({
  handle,
  existingGSite,
  onSave,
  onBack,
}: GSiteCreatorProps) {
  const isEditing = !!existingGSite;

  // Form state
  const [gsiteType, setGSiteType] = useState<GSiteType>((existingGSite?.['@type'] as GSiteType) || 'Person');
  const [name, setName] = useState(existingGSite?.name || '');
  const [tagline, setTagline] = useState(existingGSite?.tagline || '');
  const [bio, setBio] = useState(existingGSite?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(existingGSite?.avatar?.url || '');
  const [coverUrl, setCoverUrl] = useState(existingGSite?.cover?.url || '');
  const [links, setLinks] = useState<GSiteLink[]>(existingGSite?.links || []);
  const [skills, setSkills] = useState<string[]>(
    (existingGSite as PersonGSite)?.skills || []
  );
  const [interests] = useState<string[]>(
    (existingGSite as PersonGSite)?.interests || []
  );
  const [statusText, setStatusText] = useState(
    (existingGSite as PersonGSite)?.status?.text || ''
  );
  const [statusEmoji, setStatusEmoji] = useState(
    (existingGSite as PersonGSite)?.status?.emoji || ''
  );
  const [available, setAvailable] = useState(
    (existingGSite as PersonGSite)?.status?.available ?? true
  );

  // Business-specific
  const [category, setCategory] = useState(
    (existingGSite as BusinessGSite)?.category || ''
  );

  // UI state
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showSkillInput, setShowSkillInput] = useState(false);
  const [newSkill, setNewSkill] = useState('');

  // ===========================================
  // LOAD LOCAL DATA (IF NEW)
  // ===========================================

  React.useEffect(() => {
    if (!existingGSite && handle) {
      const local = getLocalGSite(handle);
      if (local) {
        console.log('Using local GSite data:', local);
        setGSiteType((local['@type'] as GSiteType) || 'Person');
        setName(local.name || '');
        setTagline(local.tagline || '');
        setBio(local.bio || '');
        setAvatarUrl(local.avatar?.url || '');
        setCoverUrl(local.cover?.url || '');
        setLinks(local.links || []);
        if (local['@type'] === 'Person') {
          const p = local as PersonGSite;
          setSkills(p.skills || []);
          // interests not in state setter?
          setStatusText(p.status?.text || '');
          setStatusEmoji(p.status?.emoji || '');
          setAvailable(p.status?.available ?? true);
        }
      }
    }
  }, [existingGSite, handle]);

  // ===========================================
  // BUILD GSITE OBJECT
  // ===========================================

  const buildGSite = (): Partial<GSite> => {
    const base = {
      '@context': 'https://schema.gns.network/v1',
      '@type': gsiteType,
      '@id': `@${handle}`,
      name,
      tagline: tagline || undefined,
      bio: bio || undefined,
      avatar: avatarUrl ? { url: avatarUrl } : undefined,
      cover: coverUrl ? { url: coverUrl } : undefined,
      links,
      actions: DEFAULT_ACTIONS,
      version: existingGSite?.version ? existingGSite.version + 1 : 1,
      signature: '', // Will be added by backend
    };

    if (gsiteType === 'Person') {
      return {
        ...base,
        skills,
        interests,
        facets: [],
        status: (statusText || statusEmoji) ? {
          text: statusText || undefined,
          emoji: statusEmoji || undefined,
          available,
        } : undefined,
      } as Partial<PersonGSite>;
    }

    if (gsiteType === 'Business') {
      return {
        ...base,
        category,
        subcategories: [],
        menu: [],
        features: [],
      } as Partial<BusinessGSite>;
    }

    return base;
  };

  // ===========================================
  // SAVE HANDLER
  // ===========================================

  const handleSave = async () => {
    setSaving(true);
    setErrors([]);

    const gsite = buildGSite();

    // Validate first
    const validation = await validateGSite(gsite);
    if (!validation.valid) {
      setErrors(validation.errors);
      setSaving(false);
      return;
    }

    // Save
    const result = await saveGSite(gsite);

    setSaving(false);

    if (result.success && result.data) {
      onSave?.(result.data);
    } else {
      setErrors([{ path: '', message: result.error || 'Failed to save' }]);
    }
  };

  // ===========================================
  // IMAGE HANDLERS
  // ===========================================

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToBase64(file);
      const resized = await resizeImage(dataUrl, 400, 400, 0.8);
      setAvatarUrl(resized);
    } catch (err) {
      console.error('Error uploading avatar:', err);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToBase64(file);
      const resized = await resizeImage(dataUrl, 1200, 400, 0.85);
      setCoverUrl(resized);
    } catch (err) {
      console.error('Error uploading cover:', err);
    }
  };

  // ===========================================
  // LINK HANDLERS
  // ===========================================

  const addLink = (link: GSiteLink) => {
    setLinks([...links, link]);
    setShowLinkModal(false);
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  // ===========================================
  // SKILL HANDLERS
  // ===========================================

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
    setShowSkillInput(false);
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
  };

  // ===========================================
  // RENDER
  // ===========================================

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* Header */}
      <div className="sticky top-0 pt-[env(safe-area-inset-top)] bg-[#0D1117] border-b border-[#21262D] z-50">
        <div className="flex items-center justify-between p-4">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-[#21262D] rounded-lg">
            <ArrowLeft size={24} className="text-gray-400" />
          </button>
          <h1 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Profile' : 'Create Profile'}
          </h1>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <Save size={18} />
            )}
            Save
          </button>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="m-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertCircle size={18} />
            <span className="font-medium">Validation Errors</span>
          </div>
          {errors.map((err, i) => (
            <div key={i} className="text-red-300 text-sm">
              {err.path ? `${err.path}: ` : ''}{err.message}
            </div>
          ))}
        </div>
      )}

      <div className="p-4 space-y-6 pb-24">
        {/* Type Selector */}
        {!isEditing && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <label className="block text-gray-400 text-sm mb-3">Profile Type</label>
            <div className="flex gap-2">
              {(['Person', 'Business'] as GSiteType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setGSiteType(type)}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors ${gsiteType === type
                    ? 'bg-blue-500 text-white'
                    : 'bg-[#21262D] text-gray-400 hover:bg-[#30363D]'
                    }`}
                >
                  {type === 'Person' ? '👤' : '🏢'} {type}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cover Image */}
        <div className="bg-[#161B22] rounded-xl overflow-hidden">
          <div
            className="h-32 bg-gradient-to-r from-blue-500 to-purple-600 relative"
            style={coverUrl ? {
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            } : undefined}
          >
            <label className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer hover:bg-black/40 transition-colors">
              <div className="flex flex-col items-center text-white/80">
                <ImageIcon size={24} />
                <span className="text-sm mt-1">Cover Image</span>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Avatar */}
          <div className="p-4 -mt-12 flex items-end gap-4">
            <label className="relative cursor-pointer group">
              <div className="w-20 h-20 rounded-full border-4 border-[#161B22] overflow-hidden bg-[#21262D]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera size={24} className="text-gray-500" />
                  </div>
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={20} className="text-white" />
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
            <div className="text-gray-400 text-sm pb-2">
              @{handle}
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-[#161B22] rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Display Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-[#21262D] text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              placeholder="A short description"
              className="w-full bg-[#21262D] text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>

          {gsiteType === 'Business' && (
            <div>
              <label className="block text-gray-400 text-sm mb-2">Category *</label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g., Restaurant, Tech Company"
                className="w-full bg-[#21262D] text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              />
            </div>
          )}
        </div>

        {/* Bio */}
        <div className="bg-[#161B22] rounded-xl p-4">
          <label className="block text-gray-400 text-sm mb-2">Bio</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Tell your story..."
            rows={4}
            className="w-full bg-[#21262D] text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder-gray-500"
          />
        </div>

        {/* Status (Person only) */}
        {gsiteType === 'Person' && (
          <div className="bg-[#161B22] rounded-xl p-4 space-y-4">
            <label className="block text-gray-400 text-sm">Status</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={statusEmoji}
                onChange={e => setStatusEmoji(e.target.value.slice(0, 2))}
                placeholder="😊"
                className="w-16 bg-[#21262D] text-white text-center rounded-lg px-2 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={statusText}
                onChange={e => setStatusText(e.target.value)}
                placeholder="What's on your mind?"
                className="flex-1 bg-[#21262D] text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Available for contact</span>
              <button
                onClick={() => setAvailable(!available)}
                className={`w-12 h-7 rounded-full transition-colors ${available ? 'bg-green-500' : 'bg-[#21262D]'
                  }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${available ? 'translate-x-6' : 'translate-x-1'
                  }`} />
              </button>
            </div>
          </div>
        )}

        {/* Skills (Person only) */}
        {gsiteType === 'Person' && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <label className="block text-gray-400 text-sm mb-3">Skills</label>
            <div className="flex flex-wrap gap-2">
              {skills.map(skill => (
                <div
                  key={skill}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg"
                >
                  <span>{skill}</span>
                  <button onClick={() => removeSkill(skill)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              {showSkillInput ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={e => setNewSkill(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSkill()}
                    placeholder="Add skill"
                    className="w-32 bg-[#21262D] text-white rounded-lg px-3 py-1.5 text-sm outline-none"
                    autoFocus
                  />
                  <button onClick={addSkill} className="p-1 text-green-400">
                    <Check size={18} />
                  </button>
                  <button onClick={() => setShowSkillInput(false)} className="p-1 text-gray-400">
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSkillInput(true)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-[#30363D] text-gray-400 rounded-lg hover:border-green-500 hover:text-green-400 transition-colors"
                >
                  <Plus size={14} />
                  Add
                </button>
              )}
            </div>
          </div>
        )}

        {/* Links */}
        <div className="bg-[#161B22] rounded-xl p-4">
          <label className="block text-gray-400 text-sm mb-3">Links</label>
          <div className="space-y-2">
            {links.map((link, i) => (
              <div key={i} className="flex items-center gap-3 bg-[#21262D] rounded-lg p-3">
                <span className="text-lg">{getLinkEmoji(link.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm truncate">{link.url || link.handle}</div>
                  <div className="text-gray-500 text-xs capitalize">{link.type}</div>
                </div>
                <button onClick={() => removeLink(i)} className="p-1 text-red-400">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setShowLinkModal(true)}
              className="w-full py-3 border border-dashed border-[#30363D] text-gray-400 rounded-lg hover:border-blue-500 hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Add Link
            </button>
          </div>
        </div>
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <AddLinkModal
          onAdd={addLink}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}

// ===========================================
// ADD LINK MODAL
// ===========================================

interface AddLinkModalProps {
  onAdd: (link: GSiteLink) => void;
  onClose: () => void;
}

function AddLinkModal({ onAdd, onClose }: AddLinkModalProps) {
  const [type, setType] = useState<GSiteLink['type']>('website');
  const [url, setUrl] = useState('');

  const linkTypes: { type: GSiteLink['type']; label: string; emoji: string }[] = [
    { type: 'website', label: 'Website', emoji: '🌐' },
    { type: 'twitter', label: 'Twitter', emoji: '𝕏' },
    { type: 'instagram', label: 'Instagram', emoji: '📸' },
    { type: 'github', label: 'GitHub', emoji: '🐙' },
    { type: 'linkedin', label: 'LinkedIn', emoji: '💼' },
    { type: 'youtube', label: 'YouTube', emoji: '📺' },
  ];

  const handleAdd = () => {
    if (!url.trim()) return;
    onAdd({ type, url: url.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161B22] w-full max-w-md rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Add Link</h3>

        <div className="flex flex-wrap gap-2 mb-4">
          {linkTypes.map(lt => (
            <button
              key={lt.type}
              onClick={() => setType(lt.type)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm ${type === lt.type
                ? 'bg-blue-500 text-white'
                : 'bg-[#21262D] text-gray-400'
                }`}
            >
              <span>{lt.emoji}</span>
              {lt.label}
            </button>
          ))}
        </div>

        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-[#21262D] text-white rounded-lg px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          autoFocus
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-[#21262D] text-gray-400 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!url.trim()}
            className="flex-1 py-3 bg-blue-500 text-white rounded-lg disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// HELPERS
// ===========================================

function getLinkEmoji(type: string): string {
  switch (type) {
    case 'twitter': return '𝕏';
    case 'instagram': return '📸';
    case 'github': return '🐙';
    case 'linkedin': return '💼';
    case 'youtube': return '📺';
    case 'tiktok': return '🎵';
    default: return '🌐';
  }
}

export default GSiteCreator;
