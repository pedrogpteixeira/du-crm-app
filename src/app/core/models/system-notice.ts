export type SystemNoticeType = 'info' | 'warning' | 'error';
export type SystemNoticeAudience = 'authenticated' | 'all';

export interface SystemNoticeImage {
  originalName: string;
  fileName: string;
  mimetype: string;
  size: number;
}

export interface SystemNotice {
  id: string;
  title: string;
  message: string;
  type: SystemNoticeType;
  audience: SystemNoticeAudience;
  deferWhileCriticalRequest: boolean;
  publishedAt: string;
  expiresAt?: string | null;
  active?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  image?: SystemNoticeImage | null;
}

export interface SystemNoticeCreateInput {
  title: string;
  message: string;
  type: SystemNoticeType;
  audience: SystemNoticeAudience;
  deferWhileCriticalRequest: boolean;
  expiresAt?: string | null;
}

export interface SystemNoticeCreateResponse {
  message?: string;
  notice: SystemNotice;
  recipientSockets?: number;
}
