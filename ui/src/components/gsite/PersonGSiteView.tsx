// ===========================================
// GNS BROWSER - PERSON GSITE VIEW
// ===========================================
// Profile view for Person type gSites

// import React from 'react';
import {
  MapPin,
  Link as LinkIcon,
  Briefcase,
  Heart,
  Hash,
} from 'lucide-react';
import { PersonGSite, getLinkUrl, getLinkIcon, formatLocation } from '../../types/gsite';
import { GSiteHeader } from './GSiteHeader';
import { GSiteActionBar, GSiteLinkButton } from './GSiteActionBar';
import { TrustBadge } from './TrustBadge';

interface PersonGSiteViewProps {
  gsite: PersonGSite;
  onBack?: () => void;
  onMessage?: () => void;
  onPayment?: () => void;
}

export function PersonGSiteView({
  gsite,
  onBack,
  onMessage,
  onPayment,
}: PersonGSiteViewProps) {
  const locationStr = formatLocation(gsite.location);

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* Header with Cover & Avatar */}
      <GSiteHeader gsite={gsite} onBack={onBack} />

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Tagline */}
        {gsite.tagline && (
          <p className="text-lg text-gray-300 leading-relaxed">
            {gsite.tagline}
          </p>
        )}

        {/* Location */}
        {locationStr && (
          <div className="flex items-center gap-2 text-gray-400">
            <MapPin size={16} />
            <span>{locationStr}</span>
          </div>
        )}

        {/* Action Bar */}
        <GSiteActionBar
          gsite={gsite}
          onMessage={onMessage}
          onPayment={onPayment}
        />

        {/* Trust Badge */}
        {gsite.trust && (
          <TrustBadge trust={gsite.trust} />
        )}

        {/* Bio */}
        {gsite.bio && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <span className="text-xl">📝</span>
              About
            </h3>
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
              {gsite.bio}
            </p>
          </div>
        )}

        {/* Facets */}
        {gsite.facets && gsite.facets.length > 0 && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Hash size={18} className="text-blue-400" />
              Facets
            </h3>
            <div className="flex flex-wrap gap-2">
              {gsite.facets.filter(f => f.public).map((facet) => (
                <div
                  key={facet.id}
                  className="px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-sm font-medium"
                >
                  {facet.name}@
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {gsite.skills && gsite.skills.length > 0 && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Briefcase size={18} className="text-green-400" />
              Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {gsite.skills.map((skill, i) => (
                <div
                  key={i}
                  className="px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-sm"
                >
                  {skill}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interests */}
        {gsite.interests && gsite.interests.length > 0 && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Heart size={18} className="text-pink-400" />
              Interests
            </h3>
            <div className="flex flex-wrap gap-2">
              {gsite.interests.map((interest, i) => (
                <div
                  key={i}
                  className="px-3 py-1.5 bg-pink-500/10 text-pink-400 rounded-lg text-sm"
                >
                  {interest}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Links */}
        {gsite.links && gsite.links.length > 0 && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <LinkIcon size={18} className="text-purple-400" />
              Links
            </h3>
            <div className="space-y-2">
              {gsite.links.map((link, i) => (
                <GSiteLinkButton
                  key={i}
                  url={getLinkUrl(link)}
                  icon={getLinkIcon(link.type)}
                  label={link.label || link.handle || link.type}
                  type={link.type}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 text-gray-600 text-sm">
          <div className="flex items-center justify-center gap-2">
            <span>Powered by</span>
            <span className="text-xl">🌐</span>
            <span className="font-medium text-gray-500">GNS Protocol</span>
          </div>
          {gsite.version > 1 && (
            <div className="mt-2 text-gray-700">
              Version {gsite.version}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PersonGSiteView;
