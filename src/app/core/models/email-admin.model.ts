export interface EmailAdminAccount {
  id: string;
  address: string;
  displayName: string | null;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateEmailAccountPayload {
  address: string;
  displayName?: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
}

export interface UpdateEmailAccountPayload {
  displayName?: string;
  isActive?: boolean;
  password?: string;
}

export interface EmailAccountUserAccess {
  userId: string;
  canRead: boolean;
  canSend: boolean;
  canManageMessages: boolean;
}

export interface UpdateEmailAccountUserPayload {
  canRead: boolean;
  canSend: boolean;
  canManageMessages: boolean;
}

export interface EmailConnectionTestResult {
  success: boolean;
  message: string | null;
  connections: {
    imap: string | null;
    smtp: string | null;
  };
}
