/**
 * Home Tab - Identity overview and quick actions
 * 
 * Shows correct handle status:
 * - Reserved: Handle chosen but < 100 breadcrumbs
 * - Claimed: Handle + 100+ breadcrumbs (permanently yours)
 * 
 * Also shows GNS token balance and wallet actions
 */

import { useNavigate } from 'react-router-dom';
import {
  Copy,
  Check,
  ExternalLink,
  QrCode,
  ArrowRight,
  Sparkles,
  Clock,
  Wallet,
  Send,
  Gift,
  History,
} from 'lucide-react';
import { useState } from 'react';
import { useIdentity, useBreadcrumbStatus, useStellarBalances } from '../lib/tauri';

interface HomeTabProps {
  onViewGSite?: (handle: string) => void;
}

export function HomeTab({ onViewGSite }: HomeTabProps) {
  const navigate = useNavigate();
  // const { onViewProfile } = useOutletContext<{ onViewProfile: (h: string) => void }>(); // Removed
  const { publicKey, handle } = useIdentity();
  const { status: breadcrumbStatus } = useBreadcrumbStatus();
  const { balances: stellarBalances } = useStellarBalances();
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

  // Determine handle status
  const breadcrumbCount = breadcrumbStatus?.count ?? 0;
  const isHandleClaimed = handle && breadcrumbCount >= 100;
  const isHandleReserved = handle && breadcrumbCount < 100;
  const canClaimHandle = handle && breadcrumbCount >= 100 && !breadcrumbStatus?.handle_claimed;

  // Calculate progress
  const progressPercent = breadcrumbStatus?.progress_percent ?? 0;
  const remaining = Math.max(0, 100 - breadcrumbCount);

  // Stellar balances
  const totalClaimable = stellarBalances?.claimable_gns.reduce(
    (sum, cb) => sum + parseFloat(cb.amount || '0'),
    0
  ) || 0;

  return (
    <div className="p-4 space-y-6">
      {/* Identity Card */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            {handle ? (
              <>
                <h1 className="text-2xl font-bold text-white">@{handle}</h1>
                {isHandleClaimed ? (
                  <p className="text-green-400 text-sm flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    Your handle is claimed
                  </p>
                ) : (
                  <p className="text-yellow-400 text-sm flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Reserved • {remaining} breadcrumbs to claim
                  </p>
                )}
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-white">Anonymous</h1>
                <p className="text-slate-400 text-sm">
                  Collect breadcrumbs to claim your @handle
                </p>
              </>
            )}
          </div>

          {/* Avatar */}
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${isHandleClaimed
            ? 'bg-gradient-to-br from-green-500 to-emerald-600'
            : isHandleReserved
              ? 'bg-gradient-to-br from-yellow-500 to-orange-600'
              : 'bg-gradient-to-br from-blue-500 to-purple-600'
            }`}>
            {handle ? handle[0].toUpperCase() : '?'}
          </div>
        </div>

        {/* Public Key */}
        <div className="bg-surface/50 rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs mb-1">Public Key</p>
            <p className="font-mono text-sm text-white">{shortKey}</p>
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

      {/* GNS Token Balance Card */}
      {stellarBalances && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center">
                <span className="text-white font-bold">G</span>
              </div>
              <div>
                <h2 className="font-semibold text-white">GNS Tokens</h2>
                <p className="text-slate-400 text-sm">
                  {stellarBalances.account_exists ? 'Active wallet' : 'Not activated'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-white">
                {stellarBalances.gns_balance.toFixed(2)}
              </span>
              <p className="text-slate-400 text-xs">
                + {stellarBalances.xlm_balance.toFixed(2)} XLM
              </p>
            </div>
          </div>

          {/* Claimable Tokens Alert */}
          {totalClaimable > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <span className="text-amber-400 font-medium">
                  {totalClaimable.toFixed(0)} GNS claimable!
                </span>
              </div>
              <button
                onClick={() => navigate('/wallet/tokens')}
                className="text-amber-400 text-sm hover:underline"
              >
                Claim →
              </button>
            </div>
          )}

          {/* Wallet Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/wallet/tokens')}
              className="flex-1 py-2.5 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              Wallet
            </button>
            <button
              onClick={() => navigate('/wallet/send')}
              disabled={!stellarBalances.account_exists}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
            <button
              onClick={() => navigate('/wallet/history')}
              className="py-2.5 px-3 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 flex items-center justify-center"
            >
              <History className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Handle Progress - Show for reserved handles */}
      {isHandleReserved && breadcrumbStatus && (
        <div className="card p-6 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-500/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-white">@{handle}</h2>
              <p className="text-yellow-400 text-sm">
                Reserved • {breadcrumbCount} / 100 breadcrumbs
              </p>
            </div>
            <span className="text-2xl font-bold text-yellow-400">
              {Math.round(progressPercent)}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {canClaimHandle ? (
            <button
              onClick={() => navigate('/claim')}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Claim Your @handle Now!
            </button>
          ) : (
            <p className="text-yellow-400/80 text-sm text-center">
              🎯 {remaining} more breadcrumbs to permanently claim your handle
            </p>
          )}
        </div>
      )}

      {/* No Handle Yet - Show progress */}
      {!handle && breadcrumbStatus && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-white">Breadcrumb Progress</h2>
              <p className="text-slate-400 text-sm">
                {breadcrumbCount} / 100 collected
              </p>
            </div>
            <span className="text-2xl font-bold text-blue-400">
              {Math.round(progressPercent)}%
            </span>
          </div>

          <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <p className="text-slate-500 text-sm text-center">
            {remaining > 0
              ? `${remaining} more breadcrumbs needed to reserve a handle`
              : 'You can now reserve your @handle!'}
          </p>
        </div>
      )}

      {/* Handle Claimed Success */}
      {isHandleClaimed && (
        <div className="card p-6 bg-green-900/20 border-green-500/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h2 className="font-semibold text-green-400">Handle Claimed!</h2>
              <p className="text-green-400/80 text-sm">
                @{handle} is permanently yours on the network
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="font-semibold px-1 text-white">Quick Actions</h2>

        <QuickAction
          icon={<QrCode className="w-5 h-5" />}
          title="Share Identity"
          description="Show QR code for your identity"
          onClick={() => { }}
        />

        <QuickAction
          icon={<ExternalLink className="w-5 h-5" />}
          title="View gSite"
          description="Your public profile page"
          onClick={() => (handle && onViewGSite) ? onViewGSite(`@${handle}`) : null}
          disabled={!isHandleClaimed}
          disabledReason={isHandleReserved ? 'Claim handle first' : 'No handle yet'}
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
  disabledReason,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`card p-4 w-full flex items-center gap-4 text-left transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700/30'
        }`}
    >
      <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-blue-400">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-medium text-white">{title}</h3>
        <p className="text-slate-400 text-sm">
          {disabled && disabledReason ? disabledReason : description}
        </p>
      </div>
      <ArrowRight className="w-5 h-5 text-slate-500" />
    </button>
  );
}
