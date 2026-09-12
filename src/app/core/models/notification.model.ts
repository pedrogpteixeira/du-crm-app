export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export type ContractNotificationResource =
  | 'contracts/repsol'
  | 'contracts/wallbox'
  | 'contracts/yes-energy'
  | 'contracts/galp-power-gas'
  | 'contracts/galp-solar'
  | 'contracts/iberdrola'
  | 'contracts/iberdrola-solar'
  | 'contracts/meo-energias';

export type NotificationResource =
  | 'omie'
  | 'mibgas'
  | 'ticket'
  | ContractNotificationResource;

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;

  resource?: NotificationResource;
  resourceId?: string;

  targetRoleIncludes?: string;
  targetUserIds?: string[];

  createdBy?: string;
  readBy: string[];

  active: boolean;

  createdAt?: string;
  updatedAt?: string;
}
