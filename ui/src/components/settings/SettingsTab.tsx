// ===========================================
// GNS BROWSER - SETTINGS TAB (MAIN)
// ===========================================
// Complete settings page with facets, theme, and identity management

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  CreditCard,
  Bug,
  Trash2,
  ChevronRight,
  Building2,
  Smartphone,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { ProfileFacet } from '../../types/profile';
import { getLocalFacets } from '../../lib/profile';
import { getIdentity, deleteIdentity } from '../../lib/tauri';
import { FacetList } from './FacetList';
import { ThemeToggle, useTheme } from './ThemeToggle';

interface SettingsTabProps {
  onIdentityDeleted?: () => void;
}

export function SettingsTab({ onIdentityDeleted }: SettingsTabProps) {
  const { onViewProfile } = useOutletContext<{ onViewProfile: (h: string) => void }>();
  const [theme, setTheme] = useTheme();
  const [facets, setFacets] = useState<ProfileFacet[]>([]);
  const [handle, setHandle] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load facets
      const loadedFacets = getLocalFacets();
      setFacets(loadedFacets);

      // Load identity info
      const identity = await getIdentity();
      setHandle(identity?.handle);
    } catch (e) {
      console.error('Error loading settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteIdentity = async () => {
    try {
      await deleteIdentity();
      onIdentityDeleted?.();
    } catch (e) {
      console.error('Error deleting identity:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={32} className="text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border p-4 z-10 transition-colors duration-300">
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
      </div>

      <div className="p-4 pb-24 space-y-6">
        {/* Facets Section */}
        <FacetList
          facets={facets}
          handle={handle}
          onFacetsChange={loadData}
        />

        {/* View GSite Button */}
        <button
          onClick={() => handle ? onViewProfile(`@${handle}`) : null}
          disabled={!handle}
          className="w-full bg-[#161B22] rounded-xl p-4 flex items-center gap-3 hover:bg-[#21262D] transition-colors disabled:opacity-50"
        >
          <ExternalLink size={20} className="text-blue-400" />
          <div className="text-left">
            <div className="text-white">View gSite</div>
            <div className="text-gray-500 text-sm">Your public profile page</div>
          </div>
        </button>

        {/* Financial Section */}
        <div className="bg-surface rounded-xl overflow-hidden transition-colors duration-300">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CreditCard size={20} className="text-green-500" />
              </div>
              <span className="text-text-primary font-semibold tracking-wider text-sm">FINANCIAL</span>
            </div>
          </div>

          <button className="w-full p-4 flex items-center justify-between hover:bg-surface-light transition-colors border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-light flex items-center justify-center">
                <CreditCard size={18} className="text-text-secondary" />
              </div>
              <div className="text-left">
                <div className="text-text-primary">Payment Methods</div>
                <div className="text-text-muted text-sm">Add crypto or card endpoints</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-text-muted" />
          </button>

          <button className="w-full p-4 flex items-center justify-between hover:bg-surface-light transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-light flex items-center justify-center">
                <span className="text-text-secondary">⚡</span>
              </div>
              <div className="text-left">
                <div className="text-text-primary">Limits & Preferences</div>
                <div className="text-text-muted text-sm">Daily limits, auto-accept settings</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-text-muted" />
          </button>
        </div>

        {/* Theme Section */}
        <ThemeToggle theme={theme} onThemeChange={setTheme} />

        {/* Organization Registration */}
        <button className="w-full bg-surface rounded-xl p-4 flex items-center justify-between hover:bg-surface-light transition-colors duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Building2 size={20} className="text-purple-500" />
            </div>
            <div className="text-left">
              <div className="text-text-primary">Register Organization</div>
              <div className="text-text-muted text-sm">Claim your namespace@ with DNS verification</div>
            </div>
          </div>
          <ChevronRight size={20} className="text-text-muted" />
        </button>

        {/* Developer Tools */}
        <button className="w-full bg-purple-500/10 rounded-xl p-4 flex items-center justify-between hover:bg-purple-500/20 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <Bug size={20} className="text-purple-400" />
            <div className="text-left">
              <div className="text-text-primary">Developer Tools</div>
              <div className="text-text-muted text-sm">Debug & publish GNS record</div>
            </div>
          </div>
          <ChevronRight size={20} className="text-text-muted" />
        </button>

        {/* Home Hub Pairing */}
        <button className="w-full bg-surface rounded-xl p-4 flex items-center justify-between hover:bg-surface-light transition-colors duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <Smartphone size={20} className="text-teal-500" />
            </div>
            <div className="text-left">
              <div className="text-text-primary">Home Hub Pairing</div>
              <div className="text-text-muted text-sm">Sync identity to Raspberry Pi, TV, or backup device</div>
            </div>
          </div>
          <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full">
            Coming Soon
          </span>
        </button>

        {/* Delete Identity */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full bg-surface rounded-xl p-4 flex items-center gap-3 hover:bg-red-500/10 transition-colors duration-300"
        >
          <Trash2 size={20} className="text-red-400" />
          <div className="text-left">
            <div className="text-red-400">Delete Identity</div>
            <div className="text-text-muted text-sm">This cannot be undone</div>
          </div>
        </button>

        {/* About Section */}
        <div className="text-center py-8">
          <div className="text-4xl mb-2">🌐</div>
          <div className="text-text-primary font-semibold text-lg">Globe Crumbs</div>
          <div className="text-text-muted">Identity through Presence</div>
          <div className="text-text-muted text-sm mt-1">v1.0.0 • Tauri Edition</div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-border">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Delete Identity?</h3>
            <p className="text-text-secondary mb-6">
              This will permanently delete your identity, all breadcrumbs, and any claimed handles.
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-surface-light text-text-secondary rounded-lg hover:bg-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteIdentity}
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

export default SettingsTab;
