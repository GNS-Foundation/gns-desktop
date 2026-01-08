// ===========================================
// BLOCK PICKER - Select block type to add
// 
// Location: panthera-browser/src/components/blocks/BlockPicker.jsx
// ===========================================

import React from 'react';
import {
  X,
  Type,
  Image,
  Link2,
  List,
  Grid3X3,
  Calendar,
  DollarSign,
  Mail,
  FileText,
  Quote,
  Play,
  Users,
  Award,
} from 'lucide-react';

// ===========================================
// BLOCK DEFINITIONS
// ===========================================

const blockTypes = [
  {
    category: 'Content',
    blocks: [
      {
        type: 'text',
        icon: Type,
        label: 'Text',
        description: 'Heading, paragraph, or quote',
        color: 'blue',
      },
      {
        type: 'media',
        icon: Image,
        label: 'Media',
        description: 'Image, gallery, or video',
        color: 'purple',
      },
      {
        type: 'link',
        icon: Link2,
        label: 'Link',
        description: 'Smart link with preview',
        color: 'cyan',
      },
      {
        type: 'list',
        icon: List,
        label: 'List',
        description: 'Skills, services, features',
        color: 'green',
      },
    ],
  },
  {
    category: 'Showcase',
    blocks: [
      {
        type: 'grid',
        icon: Grid3X3,
        label: 'Grid',
        description: 'Portfolio, projects, products',
        color: 'orange',
      },
      {
        type: 'event',
        icon: Calendar,
        label: 'Event',
        description: 'Date, location, RSVP',
        color: 'pink',
      },
      {
        type: 'price',
        icon: DollarSign,
        label: 'Pricing',
        description: 'Services with prices',
        color: 'emerald',
      },
      {
        type: 'contact',
        icon: Mail,
        label: 'Contact',
        description: 'Email, social, booking',
        color: 'indigo',
      },
    ],
  },
  // Future verified blocks (Pro)
  // {
  //   category: 'Verified (Pro)',
  //   blocks: [
  //     {
  //       type: 'affiliation',
  //       icon: Users,
  //       label: 'Work Experience',
  //       description: 'Verified by organization',
  //       color: 'amber',
  //       isPro: true,
  //     },
  //     {
  //       type: 'credential',
  //       icon: Award,
  //       label: 'Credential',
  //       description: 'Verified license or cert',
  //       color: 'amber',
  //       isPro: true,
  //     },
  //   ],
  // },
];

// ===========================================
// COLOR MAPPING
// ===========================================

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  pink: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
};

// ===========================================
// BLOCK OPTION COMPONENT
// ===========================================

function BlockOption({ block, onClick, darkMode }) {
  const Icon = block.icon;
  
  return (
    <button
      onClick={() => onClick(block.type)}
      disabled={block.isPro}
      className={`
        relative flex items-start gap-4 p-4 rounded-xl text-left
        transition-all duration-200
        ${block.isPro 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:shadow-md'
        }
        ${darkMode ? 'bg-gray-800' : 'bg-white'}
        border border-gray-200 dark:border-gray-700
      `}
    >
      {/* Icon */}
      <div className={`
        w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
        ${colorClasses[block.color]}
      `}>
        <Icon size={24} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {block.label}
        </h3>
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {block.description}
        </p>
      </div>
      
      {/* Pro badge */}
      {block.isPro && (
        <span className="absolute top-2 right-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-xs font-medium rounded-full">
          PRO
        </span>
      )}
    </button>
  );
}

// ===========================================
// MAIN BLOCK PICKER COMPONENT
// ===========================================

export default function BlockPicker({ onSelect, onClose, darkMode = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`
        relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl shadow-2xl
        ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}
      `}>
        {/* Header */}
        <div className={`
          flex items-center justify-between px-6 py-4 border-b
          ${darkMode ? 'border-gray-700' : 'border-gray-200'}
        `}>
          <div>
            <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Add Block
            </h2>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Choose a block type to add to your GSite
            </p>
          </div>
          <button
            onClick={onClose}
            className={`
              p-2 rounded-lg transition-colors
              ${darkMode 
                ? 'hover:bg-gray-800 text-gray-400' 
                : 'hover:bg-gray-100 text-gray-500'
              }
            `}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          {blockTypes.map((category) => (
            <div key={category.category} className="mb-6 last:mb-0">
              <h3 className={`
                text-sm font-medium uppercase tracking-wider mb-3
                ${darkMode ? 'text-gray-500' : 'text-gray-400'}
              `}>
                {category.category}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {category.blocks.map((block) => (
                  <BlockOption
                    key={block.type}
                    block={block}
                    onClick={onSelect}
                    darkMode={darkMode}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
