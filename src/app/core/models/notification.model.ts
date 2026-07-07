export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;

  targetRoleIncludes?: string;
  targetUserIds?: string[];

  createdBy?: string;
  readBy: string[];

  active: boolean;

  createdAt?: string;
  updatedAt?: string;
}