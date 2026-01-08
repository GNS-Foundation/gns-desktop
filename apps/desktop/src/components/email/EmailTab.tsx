import { useState } from 'react';
import {
  EmailList,
  EmailThreadView,
  EmailSidebar,
  EmailCompose
} from '@gns/ui';
import { EmailThread, EmailMessage, EmailFolder } from '@gns/api-core';

interface EmailTabProps {
  userHandle?: string;
}

export function EmailTab({ }: EmailTabProps) {
  // Navigation State
  const [currentFolder, setCurrentFolder] = useState<EmailFolder>('inbox');
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);

  // Stats (Mock for now, would come from API)
  const unreadCount = 0;

  // Compose State
  const [composeState, setComposeState] = useState<{
    isOpen: boolean;
    replyTo?: EmailMessage;
    replyAll?: boolean;
    forward?: EmailMessage;
  }>({ isOpen: false });

  // Handlers
  const handleSelectThread = (thread: EmailThread) => {
    setSelectedThread(thread);
  };

  const handleCompose = () => {
    setComposeState({ isOpen: true });
  };

  const handleReply = (message: EmailMessage, replyAll?: boolean) => {
    setComposeState({ isOpen: true, replyTo: message, replyAll });
  };

  const handleForward = (message: EmailMessage) => {
    setComposeState({ isOpen: true, forward: message });
  };

  const handleCloseCompose = () => {
    setComposeState({ isOpen: false });
  };

  return (
    <div className="flex w-full h-full bg-background text-foreground overflow-hidden">
      {/* 1. Sidebar (Folders) */}
      <EmailSidebar
        currentFolder={currentFolder}
        onSelectFolder={setCurrentFolder}
        unreadCount={unreadCount}
        className="hidden md:flex flex-none"
      />

      {/* 2. Thread List */}
      <EmailList
        onSelectThread={handleSelectThread}
        onCompose={handleCompose}
        selectedThreadId={selectedThread?.id}
        className="flex-none w-[350px] border-r border-border"
      />

      {/* 3. Thread View (Main) */}
      <div className="flex-1 min-w-0 bg-background">
        {selectedThread ? (
          <EmailThreadView
            thread={selectedThread}
            onBack={() => setSelectedThread(null)}
            onReply={handleReply}
            onForward={handleForward}
            onDelete={() => {
              // Optimistic clear
              setSelectedThread(null);
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-muted/10">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <span className="text-4xl">📧</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Effective Communication</h3>
            <p className="max-w-xs text-sm">Select an item to read it.</p>
          </div>
        )}
      </div>

      {/* Modal: Compose */}
      {composeState.isOpen && (
        <EmailCompose
          replyTo={composeState.replyTo}
          replyAll={composeState.replyAll}
          forward={composeState.forward}
          onClose={handleCloseCompose}
          onSent={() => { }}
        />
      )}
    </div>
  );
}

export default EmailTab;
