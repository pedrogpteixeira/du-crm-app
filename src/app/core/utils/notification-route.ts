import {
  ContractNotificationResource,
  Notification,
} from '../models/notification.model';

export type NotificationRoute = readonly string[];

const CONTRACT_ROUTES: Record<
  ContractNotificationResource,
  string
> = {
  'contracts/repsol': '/home/contracts/repsol',
  'contracts/wallbox': '/home/contracts/wallbox',
  'contracts/yes-energy': '/home/contracts/yes-energy',
  'contracts/galp-power-gas': '/home/contracts/galp-power-gas',
  'contracts/galp-solar': '/home/contracts/galp-solar',
  'contracts/iberdrola': '/home/contracts/iberdrola',
  'contracts/iberdrola-solar': '/home/contracts/iberdrola-solar',
  'contracts/meo-energias': '/home/contracts/meo-energias',
};

function isContractNotificationResource(
  resource: Notification['resource'],
): resource is ContractNotificationResource {
  return !!resource && resource in CONTRACT_ROUTES;
}

export function getNotificationRoute(
  notification: Notification,
): NotificationRoute | null {
  switch (notification.resource) {
    case 'omie':
    case 'mibgas':
      return ['/home/admin/omie-averages'];

    case 'ticket':
      return notification.resourceId
        ? ['/home/tickets', notification.resourceId]
        : null;

    default:
      if (
        isContractNotificationResource(notification.resource) &&
        notification.resourceId
      ) {
        return [
          CONTRACT_ROUTES[notification.resource],
          notification.resourceId,
        ];
      }

      return null;
  }
}
