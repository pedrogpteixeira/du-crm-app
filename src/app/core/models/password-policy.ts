export interface PasswordPolicy {
  enabled: boolean;
  maxAgeDays: number;
  expired: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
}
