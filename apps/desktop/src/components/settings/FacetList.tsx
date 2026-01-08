// ===========================================
// GNS BROWSER - FACET LIST COMPONENT
// ===========================================

import { useState } from 'react';
import { Plus, ChevronRight, Radio, Home, Sparkles } from 'lucide-react';
import {
  ProfileFacet,
  getFacetColor,
  FACET_TEMPLATES,
  BROADCAST_TEMPLATES,
  createFacetFromTemplate,
} from '../../types/profile';
import { saveLocalFacet, facetExists } from '../../lib/profile';
import { FacetEditor } from './FacetEditor';

interface FacetListProps {
  facets: ProfileFacet[];
  handle?: string;
  onFacetsChange: () => void;
}

export function FacetList({ facets, handle, onFacetsChange }: FacetListProps) {
  const [editingFacet, setEditingFacet] = useState<ProfileFacet | null>(null);
  const [showNewFacet, setShowNewFacet] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateFacet, setTemplateFacet] = useState<ProfileFacet | null>(null);

  // Separate facets by type
  const defaultFacets = facets.filter(f => f.type === 'defaultPersonal');
  const customFacets = facets.filter(f => f.type === 'custom' && f.id !== 'home');
  const broadcastFacets = facets.filter(f => f.type === 'broadcast');
  const homeFacet = facets.find(f => f.id === 'home');

  const handleTemplateSelect = (template: typeof FACET_TEMPLATES[0]) => {
    if (facetExists(template.id)) {
      // Already exists, just edit it
      const existing = facets.find(f => f.id === template.id);
      if (existing) {
        setEditingFacet(existing);
        setShowTemplates(false);
      }
      return;
    }

    const newFacet = createFacetFromTemplate(template);
    setTemplateFacet(newFacet);
    setShowTemplates(false);
  };

  const handleCreateHome = () => {
    const homeFacetData = createFacetFromTemplate({
      id: 'home',
      label: 'Home',
      emoji: '🏠',
      type: 'custom',
      isDefault: false,
      links: [],
    });
    saveLocalFacet(homeFacetData);
    onFacetsChange();
  };

  return (
    <div className="space-y-6">
      {/* Explanation Card */}
      <div className="bg-green-500/10 rounded-xl p-4 flex items-start gap-3">
        <span className="text-2xl">🎭</span>
        <div>
          <div className="text-white font-medium">One Identity, Many Faces</div>
          <div className="text-gray-400 text-sm">
            Same @handle, same trust, different presentation.
          </div>
        </div>
      </div>

      {/* Default Facet (me@) */}
      {defaultFacets.length > 0 && (
        <div>
          <SectionHeader icon="👤" title="DEFAULT FACET" color="#10B981" />
          {defaultFacets.map(facet => (
            <FacetCard
              key={facet.id}
              facet={facet}
              handle={handle}
              onClick={() => setEditingFacet(facet)}
            />
          ))}
        </div>
      )}

      {/* Custom Facets */}
      <div>
        <SectionHeader icon="🎨" title="CUSTOM FACETS" color="#F97316" />
        {customFacets.length > 0 ? (
          <div className="space-y-2">
            {customFacets.map(facet => (
              <FacetCard
                key={facet.id}
                facet={facet}
                handle={handle}
                onClick={() => setEditingFacet(facet)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            No custom facets yet
          </div>
        )}
      </div>

      {/* Broadcast Facets */}
      {broadcastFacets.length > 0 && (
        <div>
          <SectionHeader icon="📢" title="BROADCAST CHANNELS" color="#8B5CF6" />
          {broadcastFacets.map(facet => (
            <FacetCard
              key={facet.id}
              facet={facet}
              handle={handle}
              onClick={() => setEditingFacet(facet)}
              badge="BROADCAST"
            />
          ))}
        </div>
      )}

      {/* Home Facet (IoT) */}
      {homeFacet ? (
        <div>
          <SectionHeader icon="🏠" title="SMART HOME" color="#6366F1" />
          <FacetCard
            facet={homeFacet}
            handle={handle}
            onClick={() => setEditingFacet(homeFacet)}
            badge="IoT"
          />
        </div>
      ) : (
        <button
          onClick={handleCreateHome}
          className="w-full bg-gradient-to-r from-indigo-500/10 to-green-500/10 border border-indigo-500/30 rounded-xl p-4 flex items-center gap-4 hover:bg-indigo-500/20 transition-colors"
        >
          <Home size={28} className="text-indigo-400" />
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">home@</span>
              <span className="text-xs bg-gradient-to-r from-indigo-500 to-green-500 text-white px-2 py-0.5 rounded-full">
                IoT
              </span>
            </div>
            <div className="text-gray-500 text-sm">Control your smart home devices</div>
          </div>
          <Plus size={20} className="text-indigo-400" />
        </button>
      )}

      {/* Add Facet Button */}
      <button
        onClick={() => setShowTemplates(true)}
        className="w-full py-4 bg-green-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
      >
        <Plus size={20} />
        ADD FACET
      </button>

      {/* Template Picker Modal */}
      {showTemplates && (
        <TemplatePicker
          onSelect={handleTemplateSelect}
          onCustom={() => {
            setShowTemplates(false);
            setShowNewFacet(true);
          }}
          onClose={() => setShowTemplates(false)}
          existingIds={facets.map(f => f.id)}
        />
      )}

      {/* Facet Editor */}
      {editingFacet && (
        <FacetEditor
          facet={editingFacet}
          onSave={() => {
            setEditingFacet(null);
            onFacetsChange();
          }}
          onClose={() => setEditingFacet(null)}
        />
      )}

      {/* New Facet from Template */}
      {templateFacet && (
        <FacetEditor
          facet={templateFacet}
          isNew
          isFromTemplate
          onSave={() => {
            setTemplateFacet(null);
            onFacetsChange();
          }}
          onClose={() => setTemplateFacet(null)}
        />
      )}

      {/* New Custom Facet */}
      {showNewFacet && (
        <FacetEditor
          isNew
          onSave={() => {
            setShowNewFacet(false);
            onFacetsChange();
          }}
          onClose={() => setShowNewFacet(false)}
        />
      )}
    </div>
  );
}

// ===========================================
// SECTION HEADER
// ===========================================

function SectionHeader({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm">{icon}</span>
      <span
        className="text-xs font-bold tracking-wider"
        style={{ color }}
      >
        {title}
      </span>
    </div>
  );
}

// ===========================================
// FACET CARD
// ===========================================

interface FacetCardProps {
  facet: ProfileFacet;
  handle?: string;
  onClick: () => void;
  badge?: string;
}

function FacetCard({ facet, handle, onClick, badge }: FacetCardProps) {
  const color = getFacetColor(facet);

  return (
    <button
      onClick={onClick}
      className="w-full bg-[#161B22] rounded-xl p-4 flex items-center gap-4 hover:bg-[#1C2128] transition-colors border border-transparent hover:border-[#30363D] mb-2"
      style={{ borderColor: facet.isDefault ? `${color}30` : undefined }}
    >
      {/* Avatar */}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: `${color}20` }}
      >
        {facet.avatarUrl ? (
          <img
            src={facet.avatarUrl}
            alt={facet.label}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-2xl">{facet.emoji}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">#{facet.id}</span>
          {facet.isDefault && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
              DEFAULT
            </span>
          )}
          {badge && (
            <span
              className="text-xs text-white px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: `linear-gradient(to right, ${color}, ${badge === 'IoT' ? '#10B981' : '#EC4899'})` }}
            >
              {badge === 'IoT' ? <Radio size={10} /> : <Sparkles size={10} />}
              {badge}
            </span>
          )}
        </div>
        {facet.displayName && (
          <div className="text-gray-400 text-sm">{facet.displayName}</div>
        )}
        {handle && (
          <div className="text-gray-600 text-xs">{facet.id}@{handle}</div>
        )}
      </div>

      <ChevronRight size={20} className="text-gray-600" />
    </button>
  );
}

// ===========================================
// TEMPLATE PICKER
// ===========================================

interface TemplatePickerProps {
  onSelect: (template: typeof FACET_TEMPLATES[0]) => void;
  onCustom: () => void;
  onClose: () => void;
  existingIds: string[];
}

function TemplatePicker({ onSelect, onCustom, onClose, existingIds }: TemplatePickerProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
      <div className="bg-[#161B22] w-full max-w-md rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto animate-slide-up">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-white">Add Facet</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        {/* Templates */}
        <div className="space-y-4">
          <div className="text-gray-400 text-sm font-medium">PERSONAL</div>
          <div className="flex flex-wrap gap-2">
            {FACET_TEMPLATES.map(template => {
              const exists = existingIds.includes(template.id);
              return (
                <button
                  key={template.id}
                  onClick={() => onSelect(template)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${exists
                      ? 'bg-[#21262D] text-gray-500 opacity-50'
                      : 'bg-[#21262D] text-white hover:bg-[#30363D]'
                    }`}
                >
                  <span>{template.emoji}</span>
                  <span>{template.label}</span>
                  {exists && <span className="text-xs">(exists)</span>}
                </button>
              );
            })}
          </div>

          <div className="text-gray-400 text-sm font-medium mt-6">BROADCAST</div>
          {BROADCAST_TEMPLATES.map(template => {
            const exists = existingIds.includes(template.id);
            return (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className={`w-full p-4 rounded-xl flex items-center gap-4 transition-colors ${exists
                    ? 'bg-purple-500/5 opacity-50'
                    : 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20'
                  } border border-purple-500/30`}
              >
                <span className="text-2xl">{template.emoji}</span>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{template.id}@</span>
                    <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-0.5 rounded-full">
                      BROADCAST
                    </span>
                  </div>
                  <div className="text-gray-500 text-sm">{template.label} channel</div>
                </div>
                {exists && <span className="text-gray-500 text-xs">(exists)</span>}
              </button>
            );
          })}

          {/* Custom Option */}
          <button
            onClick={onCustom}
            className="w-full p-4 border-2 border-dashed border-[#30363D] rounded-xl flex items-center justify-center gap-2 text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors mt-6"
          >
            <Plus size={20} />
            Create Custom Facet
          </button>
        </div>
      </div>
    </div>
  );
}

export default FacetList;
