// ===========================================
// GNS BROWSER - EMAIL TYPES
// ===========================================

export interface EmailAddress {
  name?: string;
  address: string;
  handle?: string;  // GNS handle if internal
  isGns: boolean;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url?: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  bodyHtml?: string;
  attachments: EmailAttachment[];
  isRead: boolean;
  isStarred: boolean;
  isEncrypted: boolean;
  createdAt: string;
  receivedAt?: string;
}

export interface EmailThread {
  id: string;
  subject: string;
  snippet: string;
  participants: EmailAddress[];
  messageCount: number;
  unreadCount: number;
  isStarred: boolean;
  hasAttachments: boolean;
  lastMessageAt: string;
  messages?: EmailMessage[];
}

export interface EmailComposeData {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  replyToId?: string;
  attachments?: File[];
}

export interface EmailStats {
  totalThreads: number;
  unreadCount: number;
  sentToday: number;
}
