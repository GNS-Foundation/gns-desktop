/**
 * Main Layout with Tab Navigation
 */

import { NavLink, Outlet } from 'react-router-dom';
import { Home, MessageCircle, MapPin, Settings, Globe } from 'lucide-react';
import { useConnectionStatus } from '../lib/tauri';
import clsx from 'clsx';

export function MainLayout() {
  const connectionStatus = useConnectionStatus();
  const isOnline = connectionStatus?.relay_connected ?? false;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Connection status bar */}
      {!isOnline && (
        <div className="bg-yellow-900/50 border-b border-yellow-700/50 px-4 py-2">
          <p className="text-yellow-400 text-xs text-center">
            Offline - Messages will be sent when connected
          </p>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>

      {/* Tab bar */}
      <nav className="tab-bar">
        <div className="flex items-center justify-around py-2">
          <TabLink to="/" icon={<Home className="w-6 h-6" />} label="Home" />
          <TabLink
            to="/messages"
            icon={<MessageCircle className="w-6 h-6" />}
            label="Messages"
          />
          <TabLink
            to="/dix"
            icon={<Globe className="w-6 h-6" />}
            label="Dix@"
          />
          <TabLink
            to="/breadcrumbs"
            icon={<MapPin className="w-6 h-6" />}
            label="Breadcrumbs"
          />
          <TabLink
            to="/settings"
            icon={<Settings className="w-6 h-6" />}
            label="Settings"
          />
        </div>
      </nav>
    </div>
  );
}

function TabLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        clsx('tab-item', isActive && 'tab-item-active')
      }
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </NavLink>
  );
}
