// ===========================================
// GNS BROWSER - BUSINESS GSITE VIEW
// ===========================================
// Profile view for Business type gSites

import { useState } from 'react';
import {
  MapPin,
  Clock,
  Phone,
  Mail,
  Star,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  BusinessGSite,
  formatLocation,
  formatDayHours,
  isOpenNow,
  formatPrice,
  formatPriceLevel,
} from '../../types/gsite';
import { GSiteHeader } from './GSiteHeader';
import { GSiteActionBar } from './GSiteActionBar';
import { TrustBadge } from './TrustBadge';

interface BusinessGSiteViewProps {
  gsite: BusinessGSite;
  onBack?: () => void;
  onMessage?: () => void;
  onPayment?: () => void;
  onCall?: () => void;
}

export function BusinessGSiteView({
  gsite,
  onBack,
  onMessage,
  onPayment,
  onCall,
}: BusinessGSiteViewProps) {
  const [showAllHours, setShowAllHours] = useState(false);
  const locationStr = formatLocation(gsite.location);
  const isOpen = isOpenNow(gsite.hours);

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* Header with Cover & Avatar */}
      <GSiteHeader gsite={gsite} onBack={onBack} />

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Category & Rating Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm">
              {gsite.category}
            </span>
            {gsite.priceLevel && (
              <span className="text-gray-400">
                {formatPriceLevel(gsite.priceLevel)}
              </span>
            )}
          </div>

          {gsite.rating !== undefined && (
            <div className="flex items-center gap-1">
              <Star size={18} className="text-amber-400 fill-amber-400" />
              <span className="text-white font-medium">{gsite.rating.toFixed(1)}</span>
              {gsite.reviewCount && (
                <span className="text-gray-500 text-sm">
                  ({gsite.reviewCount} reviews)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tagline */}
        {gsite.tagline && (
          <p className="text-lg text-gray-300 leading-relaxed">
            {gsite.tagline}
          </p>
        )}

        {/* Quick Info Row */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
          {locationStr && (
            <div className="flex items-center gap-1.5">
              <MapPin size={14} />
              <span>{locationStr}</span>
            </div>
          )}
          {gsite.phone && (
            <div className="flex items-center gap-1.5">
              <Phone size={14} />
              <span>{gsite.phone}</span>
            </div>
          )}
        </div>

        {/* Open Status */}
        {gsite.hours && (
          <div className="flex items-center gap-2">
            <Clock size={16} className={isOpen ? 'text-green-400' : 'text-red-400'} />
            <span className={`font-medium ${isOpen ? 'text-green-400' : 'text-red-400'}`}>
              {isOpen ? 'Open Now' : 'Closed'}
            </span>
          </div>
        )}

        {/* Action Bar */}
        <GSiteActionBar
          gsite={gsite}
          onMessage={onMessage}
          onPayment={onPayment}
          onCall={onCall}
        />

        {/* Trust Badge */}
        {gsite.trust && (
          <TrustBadge trust={gsite.trust} />
        )}

        {/* Bio/Description */}
        {gsite.bio && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <h3 className="text-white font-semibold mb-2">About</h3>
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
              {gsite.bio}
            </p>
          </div>
        )}

        {/* Hours */}
        {gsite.hours && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <button
              onClick={() => setShowAllHours(!showAllHours)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Clock size={18} className="text-blue-400" />
                Hours
              </h3>
              {showAllHours ? (
                <ChevronUp size={18} className="text-gray-400" />
              ) : (
                <ChevronDown size={18} className="text-gray-400" />
              )}
            </button>

            {showAllHours && (
              <div className="mt-4 space-y-2">
                <HoursRow day="Monday" hours={gsite.hours.monday} />
                <HoursRow day="Tuesday" hours={gsite.hours.tuesday} />
                <HoursRow day="Wednesday" hours={gsite.hours.wednesday} />
                <HoursRow day="Thursday" hours={gsite.hours.thursday} />
                <HoursRow day="Friday" hours={gsite.hours.friday} />
                <HoursRow day="Saturday" hours={gsite.hours.saturday} />
                <HoursRow day="Sunday" hours={gsite.hours.sunday} />
              </div>
            )}
          </div>
        )}

        {/* Menu */}
        {gsite.menu && gsite.menu.length > 0 && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="text-xl">🍽️</span>
              Menu
            </h3>
            <div className="space-y-3">
              {gsite.menu.map((item, i) => (
                <MenuItem key={i} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Features */}
        {gsite.features && gsite.features.length > 0 && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Check size={18} className="text-green-400" />
              Features
            </h3>
            <div className="flex flex-wrap gap-2">
              {gsite.features.map((feature, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#21262D] rounded-lg text-sm text-gray-300"
                >
                  <Check size={14} className="text-green-400" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact Info */}
        {(gsite.phone || gsite.email) && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Phone size={18} className="text-blue-400" />
              Contact
            </h3>
            <div className="space-y-3">
              {gsite.phone && (
                <a
                  href={`tel:${gsite.phone}`}
                  className="flex items-center gap-3 p-3 bg-[#21262D] rounded-lg hover:bg-[#30363D] transition-colors"
                >
                  <Phone size={18} className="text-gray-400" />
                  <span className="text-white">{gsite.phone}</span>
                </a>
              )}
              {gsite.email && (
                <a
                  href={`mailto:${gsite.email}`}
                  className="flex items-center gap-3 p-3 bg-[#21262D] rounded-lg hover:bg-[#30363D] transition-colors"
                >
                  <Mail size={18} className="text-gray-400" />
                  <span className="text-white">{gsite.email}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Location Card */}
        {gsite.location && (
          <div className="bg-[#161B22] rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <MapPin size={18} className="text-red-400" />
              Location
            </h3>
            <div className="text-gray-300">{formatLocation(gsite.location)}</div>
            {gsite.location.coordinates && (
              <a
                href={`https://maps.google.com/?q=${gsite.location.coordinates.lat},${gsite.location.coordinates.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block w-full py-2 text-center bg-[#21262D] text-blue-400 rounded-lg hover:bg-[#30363D] transition-colors"
              >
                Open in Maps →
              </a>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 text-gray-600 text-sm">
          <div className="flex items-center justify-center gap-2">
            <span>Powered by</span>
            <span className="text-xl">🌐</span>
            <span className="font-medium text-gray-500">GNS Protocol</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================
// HOURS ROW
// ===========================================

interface HoursRowProps {
  day: string;
  hours?: { open: string; close: string };
}

function HoursRow({ day, hours }: HoursRowProps) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const isToday = day === today;

  return (
    <div className={`flex items-center justify-between py-1 ${isToday ? 'text-white' : 'text-gray-400'}`}>
      <span className={isToday ? 'font-medium' : ''}>{day}</span>
      <span>{hours ? formatDayHours(hours) : 'Closed'}</span>
    </div>
  );
}

// ===========================================
// MENU ITEM
// ===========================================

interface MenuItemProps {
  item: BusinessGSite['menu'][0];
}

function MenuItem({ item }: MenuItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 bg-[#21262D] rounded-lg">
      {item.image && (
        <img
          src={item.image.url}
          alt={item.name}
          className="w-16 h-16 rounded-lg object-cover"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium text-white">{item.name}</div>
          <div className="text-green-400 font-medium whitespace-nowrap">
            {formatPrice(item.price)}
          </div>
        </div>
        {item.description && (
          <p className="text-gray-400 text-sm mt-1 line-clamp-2">
            {item.description}
          </p>
        )}
        {!item.available && (
          <span className="inline-block mt-1 text-xs text-red-400">
            Currently unavailable
          </span>
        )}
      </div>
    </div>
  );
}

export default BusinessGSiteView;
