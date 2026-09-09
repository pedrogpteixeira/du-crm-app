import qualityControlBackofficeData from './quality-control-backoffice.json';

export const QUALITY_CONTROL_BACKOFFICE_OPTIONS: readonly string[] =
  qualityControlBackofficeData.backoffice;

export function canManageQualityControl(
  role: string | null | undefined,
): boolean {
  if (!role) {
    return false;
  }

  return role.includes('Super Admin') || role.includes('DU');
}
