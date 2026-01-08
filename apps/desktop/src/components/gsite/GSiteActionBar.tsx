// ===========================================
// GNS BROWSER - GSITE ACTION BAR
// ===========================================
// Action buttons for gSite profiles

// import React from 'react';
import {
  MessageCircle,
  Send,
  Phone,
  Share2,
  UserPlus,
  Navigation,
  DollarSign,
  ExternalLink,
} from 'lucide-react';
import { GSite, getHandle } from '../../types/gsite';

interface GSiteActionBarProps {
  gsite: GSite;
  onMessage?: () => void;
  onPayment?: () => void;
  onCall?: () => void;
  onShare?: () => void;
  onFollow?: () => void;
  onDirections?: () => void;
  compact?: boolean;
}

export function GSiteActionBar({
  gsite,
  onMessage,
  onPayment,
  onCall,
  onShare,
  onFollow,
  onDirections,
  compact = false,
}: GSiteActionBarProps) {
  const actions = gsite.actions || {};
  const handle = getHandle(gsite);

  const handleShare = async () => {
    if (onShare) {
      onShare();
      return;
    }

    // Default share behavior
    const shareData = {
      title: gsite.name,
      text: gsite.tagline || `Check out ${gsite.name} on GNS`,
      url: `https://gcrumbs.com/${handle}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareData.url);
      alert('Link copied to clipboard!');
    }
  };

  const handleDirections = () => {
    if (onDirections) {
      onDirections();
      return;
    }

    // Open in maps
    if (gsite.location) {
      const query = gsite.location.coordinates
        ? `${gsite.location.coordinates.lat},${gsite.location.coordinates.lng}`
        : encodeURIComponent(
          [gsite.location.address, gsite.location.city, gsite.location.country]
            .filter(Boolean)
            .join(', ')
        );
      window.open(`https://maps.google.com/?q=${query}`, '_blank');
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {actions.message && (
          <ActionIconButton
            icon={MessageCircle}
            onClick={onMessage}
            color="#3B82F6"
            label="Message"
          />
        )}
        {actions.payment && (
          <ActionIconButton
            icon={DollarSign}
            onClick={onPayment}
            color="#10B981"
            label="Pay"
          />
        )}
        {actions.share && (
          <ActionIconButton
            icon={Share2}
            onClick={handleShare}
            color="#8B5CF6"
            label="Share"
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Primary Action: Message */}
      {actions.message && (
        <button
          onClick={onMessage}
          className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
        >
          <MessageCircle size={18} />
          <span>Message</span>
        </button>
      )}

      {/* Primary Action: Payment */}
      {actions.payment && (
        <button
          onClick={onPayment}
          className="flex items-center justify-center gap-2 py-3 px-4 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
        >
          <Send size={18} />
          <span>Pay</span>
        </button>
      )}

      {/* Secondary Actions */}
      {actions.call && (
        <button
          onClick={onCall}
          className="flex items-center justify-center gap-2 py-3 px-4 bg-[#21262D] text-white rounded-xl font-medium hover:bg-[#30363D] transition-colors"
        >
          <Phone size={18} />
          <span>Call</span>
        </button>
      )}

      {actions.follow && (
        <button
          onClick={onFollow}
          className="flex items-center justify-center gap-2 py-3 px-4 bg-[#21262D] text-white rounded-xl font-medium hover:bg-[#30363D] transition-colors"
        >
          <UserPlus size={18} />
          <span>Follow</span>
        </button>
      )}

      {actions.directions && gsite.location && (
        <button
          onClick={handleDirections}
          className="flex items-center justify-center gap-2 py-3 px-4 bg-[#21262D] text-white rounded-xl font-medium hover:bg-[#30363D] transition-colors"
        >
          <Navigation size={18} />
          <span>Directions</span>
        </button>
      )}

      {actions.share && (
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 py-3 px-4 bg-[#21262D] text-white rounded-xl font-medium hover:bg-[#30363D] transition-colors"
        >
          <Share2 size={18} />
          <span>Share</span>
        </button>
      )}
    </div>
  );
}

// ===========================================
// ICON BUTTON
// ===========================================

interface ActionIconButtonProps {
  icon: any;
  onClick?: () => void;
  color: string;
  label: string;
}

function ActionIconButton({ icon: Icon, onClick, color, label }: ActionIconButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
      style={{
        backgroundColor: `${color}15`,
        color,
      }}
      title={label}
    >
      <Icon size={18} />
    </button>
  );
}

// ===========================================
// LINK BUTTON
// ===========================================

interface GSiteLinkButtonProps {
  url: string;
  icon?: string;
  label?: string;
  type: string;
}

export function GSiteLinkButton({ url, icon, label, type }: GSiteLinkButtonProps) {
  const getTypeIcon = () => {
    switch (type) {
      case 'twitter': return '𝕏';
      case 'instagram': return '📸';
      case 'github': return '🐙';
      case 'linkedin': return '💼';
      case 'youtube': return '📺';
      case 'tiktok': return '🎵';
      case 'website': return '🌐';
      default: return '🔗';
    }
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-4 py-2 bg-[#21262D] rounded-lg hover:bg-[#30363D] transition-colors"
    >
      <span className="text-lg">{icon || getTypeIcon()}</span>
      <span className="text-white text-sm">{label || type}</span>
      <ExternalLink size={14} className="text-gray-500 ml-auto" />
    </a>
  );
}

export default GSiteActionBar;
