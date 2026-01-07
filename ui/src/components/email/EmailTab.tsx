// ===========================================
// GNS BROWSER - EMAIL TAB
// ===========================================

import { useState } from 'react';
import { EmailList } from './EmailList';
import { EmailThreadView } from './EmailThread';
import { EmailCompose } from './EmailCompose';
import { EmailThread, EmailMessage } from '../../types/email';

interface EmailTabProps {
  // Optional: pass user handle for display
  userHandle?: string;
}

export function EmailTab({ }: EmailTabProps) {
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
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

  const handleBack = () => {
    setSelectedThread(null);
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

  const handleSent = () => {
    // Optionally refresh or show success message
  };

  const handleDeleteThread = () => {
    // Thread deletion is handled in EmailList
    setSelectedThread(null);
  };

  return (
    <div className="h-full">
      {/* Show thread view or list */}
      {selectedThread ? (
        <EmailThreadView
          thread={selectedThread}
          onBack={handleBack}
          onReply={handleReply}
          onForward={handleForward}
          onDelete={handleDeleteThread}
        />
      ) : (
        <EmailList
          onSelectThread={handleSelectThread}
          onCompose={handleCompose}
          selectedThreadId={(selectedThread as any)?.id}
        />
      )}

      {/* Compose modal */}
      {composeState.isOpen && (
        <EmailCompose
          replyTo={composeState.replyTo}
          replyAll={composeState.replyAll}
          forward={composeState.forward}
          onClose={handleCloseCompose}
          onSent={handleSent}
        />
      )}
    </div>
  );
}

export default EmailTab;
