import { Notification } from '../models/notification.model';
import { getNotificationRoute } from './notification-route';

function notification(
  overrides: Partial<Notification> = {},
): Notification {
  return {
    id: 'ntf_1',
    title: 'Teste',
    message: 'Teste',
    type: 'info',
    readBy: [],
    active: true,
    ...overrides,
  };
}

describe('getNotificationRoute', () => {
  it('routes OMIE and MIBGAS to the averages page', () => {
    expect(getNotificationRoute(notification({ resource: 'omie' }))).toEqual([
      '/home/admin/omie-averages',
    ]);
    expect(getNotificationRoute(notification({ resource: 'mibgas' }))).toEqual([
      '/home/admin/omie-averages',
    ]);
  });

  it('routes tickets when resourceId exists', () => {
    expect(
      getNotificationRoute(
        notification({ resource: 'ticket', resourceId: 'tkt_123' }),
      ),
    ).toEqual(['/home/tickets', 'tkt_123']);
  });

  it.each([
    ['contracts/repsol', '/home/contracts/repsol'],
    ['contracts/wallbox', '/home/contracts/wallbox'],
    ['contracts/yes-energy', '/home/contracts/yes-energy'],
    ['contracts/galp-power-gas', '/home/contracts/galp-power-gas'],
    ['contracts/galp-solar', '/home/contracts/galp-solar'],
    ['contracts/iberdrola', '/home/contracts/iberdrola'],
    ['contracts/iberdrola-solar', '/home/contracts/iberdrola-solar'],
    ['contracts/meo-energias', '/home/contracts/meo-energias'],
  ] as const)(
    'routes %s notifications to the contract detail',
    (resource, baseRoute) => {
      expect(
        getNotificationRoute(
          notification({ resource, resourceId: 'rct_123' }),
        ),
      ).toEqual([baseRoute, 'rct_123']);
    },
  );

  it('does not route notifications that require an id when it is missing', () => {
    expect(getNotificationRoute(notification())).toBeNull();
    expect(getNotificationRoute(notification({ resource: 'ticket' }))).toBeNull();
    expect(
      getNotificationRoute(notification({ resource: 'contracts/repsol' })),
    ).toBeNull();
  });
});
