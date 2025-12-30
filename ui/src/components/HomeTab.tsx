/**
 * Home Tab - Identity overview and quick actions
 */

import { useNavigate } from 'react-router-dom';
import {
  Copy,
  Check,
  ExternalLink,
  QrCode,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { useIdentity, useBreadcrumbStatus } from '../lib/tauri';

export function HomeTab() {
  const navigate = useNavigate();
  const { publicKey, handle } = useIdentity();
  const { status: breadcrumbStatus } = useBreadcrumbStatus();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortKey = publicKey
    ? `${publicKey.slice(0, 8)}...${publicKey.slice(-8)}`
    : '';

  const canClaimHandle =
    !handle && breadcrumbStatus && breadcrumbStatus.count >= 100;

  return (
    <div className="p-4 space-y-6">
      {/* Identity Card */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            {handle ? (
              <>
                <h1 className="text-2xl font-bold">@{handle}</h1>
                <p className="text-slate-400 text-sm">Your handle is claimed</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold">Anonymous</h1>
                <p className="text-slate-400 text-sm">
                  Collect breadcrumbs to claim your @handle
                </p>
              </>
            )}
          </div>

          <div className="avatar avatar-lg">
            {handle ? handle[0].toUpperCase() : '?'}
          </div>
        </div>

        {/* Public Key */}
        <div className="bg-slate-900/50 rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs mb-1">Public Key</p>
            <p className="font-mono text-sm">{shortKey}</p>
          </div>
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : (
              <Copy className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Breadcrumb Progress */}
      {!handle && breadcrumbStatus && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Breadcrumb Progress</h2>
              <p className="text-slate-400 text-sm">
                {breadcrumbStatus.count} / 100 collected
              </p>
            </div>
            <span className="text-2xl font-bold text-blue-400">
              {Math.round(breadcrumbStatus.progress_percent)}%
            </span>
          </div>

          <div className="progress-bar mb-4">
            <div
              className="progress-bar-fill"
              style={{ width: `${breadcrumbStatus.progress_percent}%` }}
            />
          </div>

          {canClaimHandle ? (
            <button
              onClick={() => navigate('/claim')}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Claim Your @handle
            </button>
          ) : (
            <p className="text-slate-500 text-sm text-center">
              {100 - breadcrumbStatus.count} more breadcrumbs needed
            </p>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="font-semibold px-1">Quick Actions</h2>

        <QuickAction
          icon={<QrCode className="w-5 h-5" />}
          title="Share Identity"
          description="Show QR code for your identity"
          onClick={() => {}}
        />

        <QuickAction
          icon={<ExternalLink className="w-5 h-5" />}
          title="View gSite"
          description="Your public profile page"
          onClick={() => {}}
          disabled={!handle}
        />
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`card p-4 w-full flex items-center gap-4 text-left transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700/30'
      }`}
    >
      <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-blue-400">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-medium">{title}</h3>
        <p className="text-slate-400 text-sm">{description}</p>
      </div>
      <ArrowRight className="w-5 h-5 text-slate-500" />
    </button>
  );
}
