// ===========================================
// GNS BROWSER - GSITE VIEWER (PHASE 2)
// ===========================================
// Complete Proof Profile viewer with Trajectory

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  SearchX,
  MessageCircle,
  Send,
  Share2,
  Calendar,
  Shield,
  CheckCircle,
  ExternalLink,
  Edit3,
  Check,
  Link as LinkIcon,
} from 'lucide-react';
import { GSiteProfile, getLinkIcon } from '../../types/gsite';
import { getGSiteCached, GSiteResult } from '../../lib/gsite';
import { TrajectorySection } from './TrajectorySection';

// ===========================================
// PROPS
// ===========================================

interface GSiteViewerProps {
  identifier: string;
  onBack?: () => void;
  onMessage?: (handle: string) => void;
  onPayment?: (handle: string) => void;
  onEdit?: (profile: GSiteProfile) => void;
  onViewMap?: () => void;
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function GSiteViewer({
  identifier,
  onBack,
  onMessage,
  onPayment,
  onEdit,
  onViewMap,
}: GSiteViewerProps) {
  const [profile, setProfile] = useState<GSiteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [identifier]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);

    const cleanId = identifier.replace(/^@/, '').toLowerCase();
    const localHandle = localStorage.getItem('gns_handle')?.replace(/^@/, '').toLowerCase();
    const isMe = localHandle === cleanId;
    setIsOwnProfile(isMe);

    console.log(`🌐 GSiteViewer loading: ${cleanId} (isMe: ${isMe})`);

    const result: GSiteResult = await getGSiteCached(identifier);

    setLoading(false);
    setIsOwnProfile(result.isOwnProfile || isMe);

    if (result.success && result.data) {
      setProfile(result.data);
    } else {
      setError(result.error || 'Profile not found');
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={32} className="text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle size={64} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Profile</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            {onBack && (
              <button onClick={onBack} className="px-4 py-2 bg-[#21262D] text-gray-300 rounded-lg">
                Go Back
              </button>
            )}
            <button
              onClick={loadProfile}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <SearchX size={64} className="text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Profile Not Found</h2>
          <p className="text-gray-400 mb-2">{identifier}</p>
          {onBack && (
            <button onClick={onBack} className="px-4 py-2 bg-[#21262D] text-gray-300 rounded-lg mt-4">
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render
  return (
    <ProfileView
      profile={profile}
      isOwnProfile={isOwnProfile}
      onBack={onBack}
      onMessage={onMessage}
      onPayment={onPayment}
      onEdit={onEdit}
      onViewMap={onViewMap}
    />
  );
}

// ===========================================
// PROFILE VIEW
// ===========================================

interface ProfileViewProps {
  profile: GSiteProfile;
  isOwnProfile: boolean;
  onBack?: () => void;
  onMessage?: (handle: string) => void;
  onPayment?: (handle: string) => void;
  onEdit?: (profile: GSiteProfile) => void;
  onViewMap?: () => void;
}

function ProfileView({
  profile,
  isOwnProfile,
  onBack,
  onMessage,
  onPayment,
  onEdit,
  onViewMap,
}: ProfileViewProps) {
  const [copied, setCopied] = useState(false);

  const name = profile.declared.displayName || profile.handle;
  const trustScore = profile.proven.trustScore || 0;
  const trustColor = getTrustColor(trustScore);
  const trustLabel = getTrustLabel(trustScore);

  const handleShare = async () => {
    const url = `https://gcrumbs.com/@${profile.handle}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text: profile.declared.bio || `Check out @${profile.handle}`, url });
        return;
      } catch { /* cancelled */ }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* ============================================= */}
      {/* HEADER */}
      {/* ============================================= */}
      <div className="relative">
        {/* Cover */}
        <div className="h-44 relative overflow-hidden">
          {profile.declared.cover?.url ? (
            <img src={profile.declared.cover.url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] via-[#0D1117]/50 to-transparent" />
        </div>

        {/* Nav buttons */}
        <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 flex justify-between z-50">
          {onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          {isOwnProfile && onEdit && (
            <button
              onClick={() => onEdit(profile)}
              className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm flex items-center gap-1.5 text-white text-sm"
            >
              <Edit3 size={14} />
              Edit
            </button>
          )}
        </div>

        {/* Avatar + Name */}
        <div className="px-4 -mt-14 relative">
          <div className="flex items-end gap-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-[#0D1117] overflow-hidden bg-[#161B22]">
                {profile.declared.avatar?.url ? (
                  <img src={profile.declared.avatar.url} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white bg-gradient-to-br from-blue-500 to-purple-600">
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {/* Trust Badge */}
              <div
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-[#0D1117]"
                style={{ backgroundColor: trustColor }}
              >
                {Math.round(trustScore)}
              </div>
            </div>

            {/* Name */}
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{name}</h1>
                {profile.isVerified && (
                  <CheckCircle size={18} className="text-blue-500 fill-blue-500/20" />
                )}
              </div>
              <div className="text-gray-400 text-sm">@{profile.handle}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================= */}
      {/* CONTENT */}
      {/* ============================================= */}
      <div className="p-4 space-y-4">

        {/* ACTION BUTTONS */}
        {!isOwnProfile ? (
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => onMessage?.(profile.handle)}
              className="flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-xl font-medium"
            >
              <MessageCircle size={18} />
              <span>Message</span>
            </button>
            <button
              onClick={() => onPayment?.(profile.handle)}
              className="flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-xl font-medium"
            >
              <Send size={18} />
              <span>Pay</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 py-3 bg-[#21262D] text-gray-300 rounded-xl font-medium"
            >
              {copied ? <Check size={18} /> : <Share2 size={18} />}
              <span>{copied ? 'Copied!' : 'Share'}</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#21262D] text-gray-300 rounded-xl font-medium"
          >
            {copied ? <Check size={18} /> : <Share2 size={18} />}
            <span>{copied ? 'Link Copied!' : 'Share My Profile'}</span>
          </button>
        )}

        {/* ============================================= */}
        {/* TRAJECTORY SECTION (PHASE 2) */}
        {/* ============================================= */}
        <TrajectorySection
          handle={profile.handle}
          isOwnProfile={isOwnProfile}
          onViewMap={onViewMap}
        />

        {/* ============================================= */}
        {/* TRUST BREAKDOWN */}
        {/* ============================================= */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: `${trustColor}10`, border: `1px solid ${trustColor}20` }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2" style={{ color: trustColor }}>
              <Shield size={18} />
              Trust Score
            </h3>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold" style={{ color: trustColor }}>
                {Math.round(trustScore)}
              </span>
              <span className="text-sm text-gray-500">/100</span>
            </div>
          </div>

          {/* Progress */}
          <div className="h-3 bg-black/20 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${trustScore}%`, backgroundColor: trustColor }}
            />
          </div>
          <div className="text-center text-sm mb-4" style={{ color: trustColor }}>
            {trustLabel}
          </div>

          {/* Component bars */}
          {profile.proven.trustBreakdown && (
            <div className="space-y-2 pt-3 border-t border-white/10">
              {Object.entries(profile.proven.trustBreakdown.components).map(([key, comp]) => (
                comp && (
                  <TrustBar
                    key={key}
                    label={key.charAt(0).toUpperCase() + key.slice(1)}
                    score={comp.score}
                    sublabel={comp.description}
                  />
                )
              ))}
            </div>
          )}

          {/* Since */}
          {profile.proven.createdAt && (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10 text-sm text-gray-500">
              <Calendar size={14} />
              <span>Member since {formatDate(profile.proven.createdAt)}</span>
            </div>
          )}
        </div>

        {/* BIO */}
        {profile.declared.bio && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span className="text-lg">📝</span>
                About
              </h3>
              <span className="text-xs text-gray-500 px-2 py-0.5 bg-[#21262D] rounded">DECLARED</span>
            </div>
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
              {profile.declared.bio}
            </p>
          </div>
        )}

        {/* SKILLS */}
        {profile.declared.skills && profile.declared.skills.length > 0 && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span className="text-lg">🛠️</span>
              Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.declared.skills.map((skill, i) => (
                <span key={i} className="px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-sm">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* LINKS */}
        {profile.declared.links && profile.declared.links.length > 0 && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <LinkIcon size={18} className="text-purple-400" />
              Links
            </h3>
            <div className="space-y-2">
              {profile.declared.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-[#21262D] rounded-lg hover:bg-[#30363D] transition-colors"
                >
                  <span className="text-lg">{getLinkIcon(link.type)}</span>
                  <span className="text-white text-sm flex-1 truncate">
                    {link.label || link.url.replace(/^https?:\/\//, '')}
                  </span>
                  <ExternalLink size={14} className="text-gray-500 flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {isOwnProfile && !profile.declared.bio && profile.declared.skills?.length === 0 && profile.declared.links?.length === 0 && (
          <div className="bg-[#161B22] rounded-xl p-6 text-center">
            <div className="text-4xl mb-3">✨</div>
            <h3 className="text-white font-semibold mb-2">Complete Your Profile</h3>
            <p className="text-gray-400 text-sm mb-4">
              Add a bio, skills, and links to make your profile stand out.
            </p>
            {onEdit && (
              <button onClick={() => onEdit(profile)} className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium">
                Edit Profile
              </button>
            )}
          </div>
        )}

        {/* FOOTER */}
        <div className="text-center py-6 text-gray-600 text-sm">
          <div className="flex items-center justify-center gap-2">
            <span>Powered by</span>
            <span className="text-xl">🌐</span>
            <span className="font-medium text-gray-500">GNS Protocol</span>
          </div>
          <div className="mt-1 text-gray-700 text-xs">
            Proof-of-Trajectory Identity
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// SUB-COMPONENTS
// ===========================================

function TrustBar({ label, score, sublabel }: { label: string; score: number; sublabel?: string }) {
  const clampedScore = Math.min(100, Math.max(0, score));
  const color = getTrustColor(clampedScore);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-500">{Math.round(clampedScore)}%</span>
      </div>
      <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${clampedScore}%`, backgroundColor: color }}
        />
      </div>
      {sublabel && <div className="text-xs text-gray-600">{sublabel}</div>}
    </div>
  );
}

// ===========================================
// HELPERS
// ===========================================

function getTrustColor(score: number): string {
  if (score >= 76) return '#3B82F6';
  if (score >= 51) return '#10B981';
  if (score >= 26) return '#FBBF24';
  return '#6B7280';
}

function getTrustLabel(score: number): string {
  if (score >= 76) return 'Highly Trusted';
  if (score >= 51) return 'Trusted';
  if (score >= 26) return 'Building Trust';
  return 'New';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

// ===========================================
// EXPORTS
// ===========================================

export function GSitePreviewCard({ gsite, onPress }: { gsite: any; onPress?: () => void }) {
  return (
    <button onClick={onPress} className="w-full bg-[#161B22] rounded-xl p-4 text-left">
      <div className="font-semibold text-white">{gsite?.declared?.displayName || gsite?.handle || 'Unknown'}</div>
      <div className="text-gray-500 text-sm">@{gsite?.handle || ''}</div>
    </button>
  );
}

export default GSiteViewer;
