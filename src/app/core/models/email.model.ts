export type EmailFolder = 'INBOX' | 'SENT' | 'DRAFTS';

export interface EmailAccountPermissions {
  canRead: boolean;
  canSend: boolean;
  canManageMessages: boolean;
}

/** DTO real de GET /api/email-accounts/mine. */
export interface EmailAccountApiItem {
  id: string;
  address: string;
  displayName: string | null;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  permissions: EmailAccountPermissions;
}

export interface EmailAccountApiResponse {
  items: EmailAccountApiItem[];
}

/** Modelo de apresentação já usado pelos componentes atuais. */
export interface EmailAccountSummary {
  id: string;
  address: string;
  displayName: string | null;
  isActive: boolean;
  permissions: EmailAccountPermissions;
}

export interface EmailAddress {
  name: string | null;
  address: string;
}

export interface EmailAttachmentApiItem {
  index: number;
  filename: string;
  contentType: string;
  size: number;
}

export interface EmailAttachmentApiResponse {
  items: EmailAttachmentApiItem[];
}

export interface EmailAttachmentSummary {
  index: number;
  filename: string;
  contentType: string;
  size: number;
}

export interface EmailDraftAttachment {
  id: string;
  filename: string;
  contentType: string | null;
  size: number;
  createdAt: string | null;
}

export interface EmailFolderApiItem {
  name: EmailFolder;
  remoteSync: boolean;
}

export interface EmailFolderApiResponse {
  items: EmailFolderApiItem[];
}

export interface EmailMessageApiSummary {
  id: string;
  accountId: string;
  folder: Exclude<EmailFolder, 'DRAFTS'>;
  kind: 'inbound' | 'outbound' | 'draft';
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  preview: string;
  hasAttachments: boolean;
  read: boolean;
  receivedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailMessageApiPage {
  total: number;
  offset: number;
  limit: number;
  items: EmailMessageApiSummary[];
}

export interface EmailMessageApiDetail extends EmailMessageApiSummary {
  bcc: string[];
  text: string;
  /** Neste endpoint, messageId é o Message-ID MIME. */
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
}

export interface EmailReadApiResponse {
  id: string;
  read: boolean;
}

export interface EmailMessageSummary {
  id: string;
  accountId: string | null;
  folder: string;
  from: EmailAddress | null;
  to: EmailAddress[];
  subject: string;
  preview: string;
  date: string | null;
  isRead: boolean | null;
  hasAttachments: boolean;
}

export interface EmailMessageDetail extends EmailMessageSummary {
  cc: EmailAddress[];
  bcc: EmailAddress[];
  text: string | null;
  /** Alias de apresentação para o `messageId` MIME devolvido no detalhe. */
  mimeMessageId: string | null;
  inReplyTo: string | null;
  references: string[];
}

export interface EmailMessagePage {
  items: EmailMessageSummary[];
  offset: number;
  limit: number;
  total: number | null;
  hasMore: boolean;
}

export interface EmailDraftApiItem {
  id: string;
  accountId: string;
  folder: 'DRAFTS';
  kind: 'draft';
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  preview: string;
  text: string;
  hasAttachments: boolean;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailDraftApiPage {
  total: number;
  offset: number;
  limit: number;
  items: EmailDraftApiItem[];
}

export interface EmailDraftSummary {
  id: string;
  accountId: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  createdAt: string | null;
  updatedAt: string | null;
  attachmentCount: number;
}

export interface EmailDraftPage {
  items: EmailDraftSummary[];
  offset: number;
  limit: number;
  total: number | null;
  hasMore: boolean;
}

export interface EmailFolderSummary {
  folder: EmailFolder;
  label: string;
  remoteSync: boolean;
}

export interface EmailComposePayload {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  replyToMessageId?: string;
  forwardMessageId?: string;
}

export interface EmailSendResult {
  id: string | null;
  /** Na resposta de envio, messageId é o ID interno CRM. */
  messageId: string | null;
  /** Message-ID MIME gerado pelo servidor SMTP. */
  mimeMessageId: string | null;
  accepted: number | null;
  rejected: number | null;
  savedToWebmail: boolean | null;
  persisted: boolean | null;
  draftRemoved: boolean | null;
}

export interface EmailSyncResult {
  folder: Exclude<EmailFolder, 'DRAFTS'>;
  fetched: number;
  inserted: number;
  skipped: number;
}

export interface EmailDraftResult {
  id: string | null;
}

export interface EmailSyncCompletedEvent extends EmailSyncResult {
  accountId: string;
}

export interface EmailSyncFailedEvent {
  accountId: string;
  folder: Exclude<EmailFolder, 'DRAFTS'>;
}

export interface EmailReadChangedEvent {
  accountId: string;
  id: string;
  read: boolean;
}

export interface EmailSentEvent {
  accountId: string;
  id: string;
}
