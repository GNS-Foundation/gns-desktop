// ===========================================
// GNS BROWSER - GSITE HEADER COMPONENT
// ===========================================
// Cover image, avatar, name, handle, status

// import React from 'react';
import { ArrowLeft, MoreVertical, CheckCircle } from 'lucide-react';
import { GSite, getHandle, isPersonGSite, PersonGSite } from '../../types/gsite';
import { TrustIndicator } from './TrustBadge';

interface GSiteHeaderProps {
  gsite: GSite;
  onBack?: () => void;
  onMore?: () => void;
}

export function GSiteHeader({ gsite, onBack, onMore }: GSiteHeaderProps) {
  const handle = getHandle(gsite);
  const status = isPersonGSite(gsite) ? (gsite as PersonGSite).status : undefined;

  // Generate gradient from name if no cover
  const generateGradient = (name: string) => {
    const colors = [
      ['#667eea', '#764ba2'],
      ['#f093fb', '#f5576c'],
      ['#4facfe', '#00f2fe'],
      ['#43e97b', '#38f9d7'],
      ['#fa709a', '#fee140'],
      ['#a8edea', '#fed6e3'],
      ['#ff9a9e', '#fecfef'],
      ['#667eea', '#764ba2'],
    ];
    const index = name.charCodeAt(0) % colors.length;
    return `linear-gradient(135deg, ${colors[index][0]}, ${colors[index][1]})`;
  };

  return (
    <div className="relative">
      {/* Cover Image */}
      <div className="h-48 relative overflow-hidden">
        {gsite.cover?.url ? (
          <img
            src={gsite.cover.url}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: generateGradient(gsite.name) }}
          />
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] via-transparent to-transparent" />

        {/* Navigation */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
          {onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          {onMore && (
            <button
              onClick={onMore}
              className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors ml-auto"
            >
              <MoreVertical size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Avatar & Info - Overlapping cover */}
      <div className="relative px-4 -mt-16">
        <div className="flex items-end gap-4">
          {/* Avatar */}
          <div className="relative">
            <div className="w-28 h-28 rounded-full border-4 border-[#0D1117] overflow-hidden bg-[#161B22]">
              {gsite.avatar?.url ? (
                <img
                  src={gsite.avatar.url}
                  alt={gsite.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white bg-gradient-to-br from-blue-500 to-purple-600">
                  {gsite.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Trust Indicator */}
            {gsite.trust && (
              <div className="absolute -bottom-1 -right-1">
                <TrustIndicator score={gsite.trust.score} size="lg" />
              </div>
            )}

            {/* Online Status */}
            {status?.available && (
              <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-green-500 border-2 border-[#0D1117]" />
            )}
          </div>

          {/* Name & Handle */}
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{gsite.name}</h1>
              {gsite.trust && gsite.trust.score >= 50 && (
                <CheckCircle size={20} className="text-blue-500" />
              )}
            </div>
            <div className="text-gray-400">{handle}</div>

            {/* Status */}
            {status?.text && (
              <div className="flex items-center gap-2 mt-1">
                {status.emoji && <span>{status.emoji}</span>}
                <span className="text-gray-500 text-sm">{status.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* Type Badge */}
        <div className="absolute top-4 right-4">
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: getTypeBgColor(gsite['@type']),
              color: getTypeTextColor(gsite['@type']),
            }}
          >
            {gsite['@type']}
          </span>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// TYPE COLORS
// ===========================================

function getTypeBgColor(type: string): string {
  switch (type) {
    case 'Person': return '#3B82F615';
    case 'Business': return '#10B98115';
    case 'Store': return '#F9731615';
    case 'Service': return '#8B5CF615';
    case 'Organization': return '#EC489915';
    case 'Event': return '#FBBF2415';
    case 'Publication': return '#06B6D415';
    case 'Community': return '#F4381815';
    default: return '#6B728015';
  }
}

function getTypeTextColor(type: string): string {
  switch (type) {
    case 'Person': return '#3B82F6';
    case 'Business': return '#10B981';
    case 'Store': return '#F97316';
    case 'Service': return '#8B5CF6';
    case 'Organization': return '#EC4899';
    case 'Event': return '#FBBF24';
    case 'Publication': return '#06B6D4';
    case 'Community': return '#F43818';
    default: return '#6B7280';
  }
}

// ===========================================
// COMPACT HEADER
// ===========================================

interface CompactHeaderProps {
  gsite: GSite;
  onPress?: () => void;
}

export function GSiteCompactHeader({ gsite, onPress }: CompactHeaderProps) {
  const handle = getHandle(gsite);

  return (
    <button
      onClick={onPress}
      className="flex items-center gap-3 w-full text-left"
    >
      {/* Avatar */}
      <div className="relative">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-[#21262D]">
          {gsite.avatar?.url ? (
            <img
              src={gsite.avatar.url}
              alt={gsite.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg font-bold text-white bg-gradient-to-br from-blue-500 to-purple-600">
              {gsite.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {gsite.trust && (
          <div className="absolute -bottom-1 -right-1">
            <TrustIndicator score={gsite.trust.score} size="sm" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-white truncate">{gsite.name}</span>
          {gsite.trust && gsite.trust.score >= 50 && (
            <CheckCircle size={14} className="text-blue-500 flex-shrink-0" />
          )}
        </div>
        <span className="text-gray-500 text-sm truncate block">{handle}</span>
      </div>
    </button>
  );
}

export default GSiteHeader;
