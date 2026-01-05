/**
 * Settings Tab
 */

import { useState, useEffect } from 'react';
import {
  User,
  Key,
  Shield,
  Download,
  Trash2,
  ExternalLink,
  ChevronRight,
  Info,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import {
  useIdentity,
  exportIdentityBackup,
  deleteIdentity,
  getAppVersion,
  openExternalUrl,
  publishIdentity,
  restoreBreadcrumbs,
  AppVersion,
} from '../lib/tauri';
import { invoke } from '@tauri-apps/api/core';

interface ConnectionStatus {
  relay_connected: boolean;
  relay_url: string;
  last_message_at: number | null;
  reconnect_attempts: number;
}

export function SettingsTab() {
  const { publicKey, handle } = useIdentity();
  const [version, setVersion] = useState<AppVersion | null>(null);
  const [showBackup, setShowBackup] = useState(false);
  const [backupKey, setBackupKey] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<ConnectionStatus | null>(null);
  const [refreshingNetwork, setRefreshingNetwork] = useState(false);

  useEffect(() => {
    getAppVersion().then(setVersion);
    loadNetworkStatus();

    // Poll network status every 5 seconds
    const interval = setInterval(loadNetworkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadNetworkStatus = async () => {
    try {
      const status = await invoke<ConnectionStatus>('get_connection_status');
      setNetworkStatus(status);
    } catch (e) {
      console.error('Failed to load network status:', e);
    }
  };

  const handleReconnect = async () => {
    try {
      setRefreshingNetwork(true);
      await invoke('reconnect');
      await loadNetworkStatus();
    } catch (e) {
      console.error('Failed to reconnect:', e);
    } finally {
      setRefreshingNetwork(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      setExporting(true);
      const backup = await exportIdentityBackup();
      setBackupKey(backup.private_key);
      setShowBackup(true);
    } catch (e) {
      console.error('Failed to export backup:', e);
    } finally {
      setExporting(false);
    }
  };

  const handleOpenUrl = async (url: string) => {
    try {
      await openExternalUrl(url);
    } catch (e) {
      console.error('Failed to open URL:', e);
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Profile Section */}
      <section>
        <h2 className="text-sm font-medium text-slate-500 mb-3 px-1">Profile</h2>
        <div className="card divide-y divide-slate-700/50">
          <SettingsItem
            icon={<User className="w-5 h-5" />}
            title={handle ? `@${handle}` : 'Anonymous'}
            subtitle={handle ? 'Your handle' : 'No handle claimed yet'}
          />
          <SettingsItem
            icon={<Key className="w-5 h-5" />}
            title="Public Key"
            subtitle={publicKey ? `${publicKey.slice(0, 16)}...` : 'None'}
            onClick={() => {
              if (publicKey) {
                navigator.clipboard.writeText(publicKey);
              }
            }}
          />
        </div>
      </section>

      {/* Network Status Section */}
      <section>
        <h2 className="text-sm font-medium text-slate-500 mb-3 px-1">Network</h2>
        <div className="card divide-y divide-slate-700/50">
          <div className="p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${networkStatus?.relay_connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
              {networkStatus?.relay_connected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <p className={`font-medium ${networkStatus?.relay_connected ? 'text-green-400' : 'text-red-400'}`}>
                {networkStatus?.relay_connected ? 'Connected' : 'Disconnected'}
              </p>
              <p className="text-slate-500 text-sm truncate">
                {networkStatus?.relay_url || 'Connecting...'}
              </p>
            </div>
            <button
              onClick={handleReconnect}
              disabled={refreshingNetwork}
              className={`p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors ${refreshingNetwork ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          {networkStatus?.last_message_at && (
            <div className="px-4 py-3 bg-slate-800/50 text-xs text-slate-500 flex justify-between">
              <span>Last message:</span>
              <span>{new Date(networkStatus.last_message_at * 1000).toLocaleTimeString()}</span>
            </div>
          )}
          <SettingsItem
            icon={<RefreshCw className="w-5 h-5" />}
            title="Sync Identity Record"
            subtitle="Manually publish identity to network"
            onClick={async () => {
              try {
                const result = await publishIdentity();
                if (result.success) {
                  alert('Identity record published successfully!');
                } else {
                  alert(`Failed to publish identity record: ${result.error || 'Unknown error'}`);
                }
              } catch (e) {
                alert(`Error: ${e}`);
              }
            }}
            showArrow
          />
        </div>
      </section>

      {/* Security Section */}
      <section>
        <h2 className="text-sm font-medium text-slate-500 mb-3 px-1">Security</h2>
        <div className="card divide-y divide-slate-700/50">
          <SettingsItem
            icon={<Download className="w-5 h-5" />}
            title="Export Backup"
            subtitle="Save your identity for recovery"
            onClick={handleExportBackup}
            loading={exporting}
            showArrow
          />
          <SettingsItem
            icon={<Download className="w-5 h-5" />}
            title="Restore Breadcrumbs"
            subtitle="Sync from cloud"
            onClick={async () => {
              try {
                const count = await restoreBreadcrumbs();
                if (count > 0) {
                  alert(`Successfully restored ${count} breadcrumbs!`);
                } else {
                  alert('No breadcrumbs found to restore.');
                }
              } catch (e) {
                alert(`Error: ${e}`);
              }
            }}
            showArrow
          />
          <SettingsItem
            icon={<Shield className="w-5 h-5" />}
            title="Security Settings"
            subtitle="Biometrics, auto-lock"
            showArrow
          />
        </div>
      </section>

      {/* Support Section */}
      <section>
        <h2 className="text-sm font-medium text-slate-500 mb-3 px-1">Support</h2>
        <div className="card divide-y divide-slate-700/50">
          <SettingsItem
            icon={<ExternalLink className="w-5 h-5" />}
            title="Documentation"
            subtitle="Learn how GNS works"
            onClick={() => handleOpenUrl('https://docs.gcrumbs.com')}
            showArrow
          />
          <SettingsItem
            icon={<ExternalLink className="w-5 h-5" />}
            title="Privacy Policy"
            onClick={() => handleOpenUrl('https://gcrumbs.com/privacy')}
            showArrow
          />
          <SettingsItem
            icon={<ExternalLink className="w-5 h-5" />}
            title="Terms of Service"
            onClick={() => handleOpenUrl('https://gcrumbs.com/terms')}
            showArrow
          />
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <h2 className="text-sm font-medium text-red-500 mb-3 px-1">Danger Zone</h2>
        <div className="card divide-y divide-slate-700/50">
          <SettingsItem
            icon={<Trash2 className="w-5 h-5 text-red-500" />}
            title="Delete Identity"
            subtitle="Permanently remove your identity"
            danger
            showArrow
            onClick={() => setShowDeleteConfirm(true)}
          />
        </div>
      </section>

      {/* App Info */}
      <section className="pt-4">
        <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
          <Info className="w-4 h-4" />
          <span>
            GNS Browser v{version?.version || '...'} ({version?.platform || '...'})
          </span>
        </div>
      </section>

      {/* Backup Modal */}
      {showBackup && (
        <BackupModal
          privateKey={backupKey || ''}
          onClose={() => {
            setShowBackup(false);
            setBackupKey(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

function SettingsItem({
  icon,
  title,
  subtitle,
  onClick,
  showArrow,
  danger,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  showArrow?: boolean;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full p-4 flex items-center gap-4 hover:bg-slate-700/20 transition-colors text-left"
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${danger ? 'bg-red-900/30 text-red-500' : 'bg-slate-700 text-slate-400'
          }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${danger ? 'text-red-500' : ''}`}>{title}</p>
        {subtitle && (
          <p className="text-slate-500 text-sm truncate">{subtitle}</p>
        )}
      </div>
      {loading && (
        <div className="w-5 h-5 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      )}
      {showArrow && !loading && (
        <ChevronRight className="w-5 h-5 text-slate-500" />
      )}
    </button>
  );
}

function BackupModal({
  privateKey,
  onClose,
}: {
  privateKey: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(privateKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md animate-slide-up">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-2">Identity Backup</h2>
          <p className="text-slate-400 text-sm mb-4">
            This is your private key. Store it securely - anyone with this key
            can access your identity.
          </p>

          <div className="bg-slate-900 rounded-lg p-4 mb-4">
            <p className="font-mono text-xs break-all text-slate-300">
              {privateKey}
            </p>
          </div>

          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-6">
            <p className="text-red-400 text-sm">
              ⚠️ Never share this key. Never store it in cloud services. Write it
              down and keep it safe.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className="btn btn-secondary flex-1"
            >
              {copied ? '✓ Copied' : 'Copy Key'}
            </button>
            <button onClick={onClose} className="btn btn-primary flex-1">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ onClose }: { onClose: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;

    try {
      setDeleting(true);
      await deleteIdentity();
      // Reload the app after deletion
      window.location.reload();
    } catch (e) {
      console.error('Failed to delete identity:', e);
      alert('Failed to delete identity. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md animate-slide-up">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-2 text-red-500">Delete Identity</h2>
          <p className="text-slate-400 text-sm mb-4">
            This action is <strong>permanent and irreversible</strong>. All your
            messages, breadcrumbs, and identity data will be deleted.
          </p>

          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">
              ⚠️ Make sure you have exported your identity backup if you want to
              recover it later.
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Type <span className="font-mono text-white">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-red-500"
              placeholder="DELETE"
              disabled={deleting}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn btn-secondary flex-1"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || deleting}
              className="btn bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              {deleting ? 'Deleting...' : 'Delete Forever'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

