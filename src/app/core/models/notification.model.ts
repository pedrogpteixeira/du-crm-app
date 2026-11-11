export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export type ContractNotificationResource =
  | 'contracts/repsol'
  | 'contracts/portulogos'
  | 'contracts/portulogos-b2b'
  | 'contracts/ezu-b2b'
  | 'contracts/nossa-energia-b2b'
  | 'contracts/audax-b2b'
  | 'contracts/plenitude-b2b'
  | 'contracts/endesa-b2b'
  | 'contracts/wallbox'
  | 'contracts/yes-energy'
  | 'contracts/galp-power-gas'
  | 'contracts/galp-solar'
  | 'contracts/iberdrola'
  | 'contracts/iberdrola-solar'
  | 'contracts/meo-energias'
  | 'contracts/vodafone';

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
