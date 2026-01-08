// ===========================================
// STUDIO DASHBOARD - Your Creative Space
// 
// Location: panthera-browser/src/components/StudioDashboard.jsx
// ===========================================

import React from 'react';
import { 
  Globe, 
  User, 
  Layers, 
  BarChart3, 
  Link2, 
  Settings,
  Star,
  ArrowRight,
  Sparkles,
  Eye,
  Calendar,
  TrendingUp
} from 'lucide-react';

// ===========================================
// STUDIO CARD COMPONENT
// ===========================================

function StudioCard({ 
  icon: Icon, 
  title, 
  description, 
  isPro = false, 
  onClick,
  stats,
  accentColor = 'cyan'
}) {
  const colorClasses = {
    cyan: 'from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400',
    purple: 'from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400',
    green: 'from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400',
    orange: 'from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400',
    pink: 'from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400',
    gray: 'from-gray-500 to-slate-500 hover:from-gray-400 hover:to-slate-400',
  };

  return (
    <button
      onClick={onClick}
      className={`
        relative group w-full text-left p-6 rounded-2xl
        bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        hover:border-transparent hover:shadow-xl
        transition-all duration-300
        ${isPro ? 'opacity-75' : ''}
      `}
    >
      {/* Pro Badge */}
      {isPro && (
        <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-xs font-bold text-white">
          <Star size={12} fill="white" />
          PRO
        </div>
      )}

      {/* Icon with gradient background */}
      <div className={`
        w-14 h-14 rounded-xl mb-4
        bg-gradient-to-br ${colorClasses[accentColor]}
        flex items-center justify-center
        group-hover:scale-110 transition-transform duration-300
      `}>
        <Icon size={28} className="text-white" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        {description}
      </p>

      {/* Stats (optional) */}
      {stats && (
        <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center gap-1">
              {stat.icon}
              <span>{stat.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Arrow indicator */}
      <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight size={20} className="text-gray-400" />
      </div>
    </button>
  );
}

// ===========================================
// QUICK STATS BAR
// ===========================================

function QuickStats({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, i) => (
        <div 
          key={i}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            {stat.icon}
            <span className="text-xs font-medium">{stat.label}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stat.value}
          </div>
          {stat.change && (
            <div className={`text-xs ${stat.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stat.change > 0 ? '+' : ''}{stat.change}% this week
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ===========================================
// MAIN STUDIO DASHBOARD
// ===========================================

export default function StudioDashboard({ 
  handle,
  onNavigate,
  isPro = false,
  darkMode = false 
}) {
  // Mock stats - replace with real data
  const quickStats = [
    { icon: <Eye size={14} />, label: 'Profile Views', value: '1,234', change: 12 },
    { icon: <Globe size={14} />, label: 'GSite Views', value: '567', change: 8 },
    { icon: <TrendingUp size={14} />, label: 'Engagement', value: '89%', change: -2 },
    { icon: <Calendar size={14} />, label: 'Days Active', value: '42', change: null },
  ];

  const tools = [
    {
      id: 'gsite',
      icon: Globe,
      title: 'GSite Builder',
      description: 'Create your professional page with blocks',
      accentColor: 'cyan',
      isPro: false,
      stats: [
        { icon: <Eye size={12} />, value: '567 views' },
        { icon: <Calendar size={12} />, value: 'Updated 2d ago' },
      ],
    },
    {
      id: 'profile',
      icon: User,
      title: 'Edit Profile',
      description: 'Photo, bio, display name, and more',
      accentColor: 'purple',
      isPro: false,
    },
    {
      id: 'facets',
      icon: Layers,
      title: 'Facets Manager',
      description: 'Create work@, friends@, pro@ identities',
      accentColor: 'green',
      isPro: false,
    },
    {
      id: 'analytics',
      icon: BarChart3,
      title: 'Analytics',
      description: 'Views, clicks, visitors, and trends',
      accentColor: 'orange',
      isPro: !isPro,
    },
    {
      id: 'domains',
      icon: Link2,
      title: 'Custom Domains',
      description: 'Connect yourname.com to your GSite',
      accentColor: 'pink',
      isPro: !isPro,
    },
    {
      id: 'settings',
      icon: Settings,
      title: 'Settings',
      description: 'Privacy, security, and preferences',
      accentColor: 'gray',
      isPro: false,
    },
  ];

  const handleToolClick = (toolId) => {
    if (onNavigate) {
      onNavigate(toolId);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                studio@{handle}
              </h1>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Your Creative Space
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats (Pro only, or show teaser) */}
        {isPro ? (
          <QuickStats stats={quickStats} />
        ) : (
          <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Star className="text-amber-500" size={24} />
                <div>
                  <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Upgrade to Pro
                  </p>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Get analytics, custom domains, and more
                  </p>
                </div>
              </div>
              <button className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-medium rounded-lg hover:from-amber-500 hover:to-orange-600 transition-colors">
                Upgrade
              </button>
            </div>
          </div>
        )}

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <StudioCard
              key={tool.id}
              icon={tool.icon}
              title={tool.title}
              description={tool.description}
              accentColor={tool.accentColor}
              isPro={tool.isPro}
              stats={tool.stats}
              onClick={() => handleToolClick(tool.id)}
            />
          ))}
        </div>

        {/* Recent Activity (optional) */}
        <div className="mt-8">
          <h2 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Recent Activity
          </h2>
          <div className={`rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-6`}>
            <div className="text-center py-8">
              <Globe size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Create your GSite to start tracking activity
              </p>
              <button 
                onClick={() => handleToolClick('gsite')}
                className="mt-4 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-400 hover:to-blue-400 transition-colors"
              >
                Create GSite
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
