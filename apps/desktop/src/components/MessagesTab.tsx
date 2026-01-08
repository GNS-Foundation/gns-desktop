// ===========================================
// GNS BROWSER - MESSAGES TAB
// With CHAT | EMAIL sub-tabs
// ===========================================

import { useState } from 'react';
import { MessageSquare, Mail } from 'lucide-react';
import { cn } from '../lib/utils';

// Import existing chat components
import { ThreadListScreen } from './messaging/ThreadListScreen';

// Import new email tab
import { EmailTab } from './email/EmailTab';

type SubTab = 'chat' | 'email';

interface MessagesTabProps {
  userHandle?: string;
  userPublicKey?: string;
}

export function MessagesTab({ userHandle, userPublicKey }: MessagesTabProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('chat');

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Sub-tab Header */}
      <div className="flex items-center border-b border-border bg-surface/50 px-2">
        <TabButton
          icon={<MessageSquare className="w-4 h-4" />}
          label="Chat"
          isActive={activeTab === 'chat'}
          onClick={() => setActiveTab('chat')}
        />
        <TabButton
          icon={<Mail className="w-4 h-4" />}
          label="Email"
          isActive={activeTab === 'email'}
          onClick={() => setActiveTab('email')}
        // Show badge for unread emails
        // badge={unreadEmailCount}
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' ? (
          <ChatTab userHandle={userHandle} userPublicKey={userPublicKey} />
        ) : (
          <EmailTab userHandle={userHandle} />
        )}
      </div>
    </div>
  );
}

// ===========================================
// TAB BUTTON COMPONENT
// ===========================================

interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}

function TabButton({ icon, label, isActive, onClick, badge }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative",
        isActive
          ? "text-indigo-400 border-b-2 border-indigo-400"
          : "text-slate-400 hover:text-slate-200"
      )}
    >
      {icon}
      {label}
      {badge && badge > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// ===========================================
// CHAT TAB (Real implementation)
// ===========================================

interface ChatTabProps {
  userHandle?: string;
  userPublicKey?: string;
}

function ChatTab({ }: ChatTabProps) {
  return (
    <div className="h-full">
      <ThreadListScreen />
    </div>
  );
}

export default MessagesTab;
