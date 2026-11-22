export type BackupProtectionStatus =
  | 'protected'
  | 'attention'
  | 'critical'
  | 'pending_upgrade'
  | 'pending_configuration'
  | 'current'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'running'
  | 'unknown'
  | string;

export interface BackupRunSummary {
  runId?: string;
  status?: BackupProtectionStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  durationMs?: number | null;
  scanned?: number | null;
  copied?: number | null;
  reused?: number | null;
  copiedBytes?: number | null;
}

export interface BackupOverview {
  configured?: boolean;
  provider?: string;
  status?: BackupProtectionStatus;
  fullyProtected?: boolean;
  latest?: BackupRunSummary | null;
  r2?: {
    status?: BackupProtectionStatus;
    ageHours?: number | null;
  } | null;
  atlas?: {
    status?: BackupProtectionStatus;
    latestSnapshotAt?: string | null;
  } | null;
  mongoAtlas?: {
    configured?: boolean;
    status?: BackupProtectionStatus;
  } | null;
}

export interface BackupHealthAlert {
  severity?: string;
  message?: string;
  code?: string;
  source?: string;
}

export interface BackupHealth {
  status?: BackupProtectionStatus;
  fullyProtected?: boolean;
  r2?: {
    status?: BackupProtectionStatus;
    ageHours?: number | null;
  } | null;
  atlas?: {
    status?: BackupProtectionStatus;
    latestSnapshotAt?: string | null;
  } | null;
  alerts?: Array<BackupHealthAlert | string>;
}

export interface AtlasSnapshot {
  id?: string;
  snapshotId?: string;
  status?: string;
  createdAt?: string | null;
  completedAt?: string | null;
  expiresAt?: string | null;
}

export interface BackupAtlasStatus {
  configured?: boolean;
  status?: BackupProtectionStatus;
  snapshots?: AtlasSnapshot[];
  latest?: AtlasSnapshot | null;
  note?: string | null;
  retention?: string | number | null;
  pitr?: boolean | string | null;
  lastCheckedAt?: string | null;
}

export interface BackupStorageBreakdown {
  storageClass?: string;
  bytes?: number | null;
  objects?: number | null;
}

export interface BackupStorage {
  totalBytes?: number | null;
  totalObjects?: number | null;
  measuredAt?: string | null;
  complete?: boolean | null;
  partial?: boolean | null;
  classes?: BackupStorageBreakdown[];
}

export interface BackupCostClassEstimate {
  storageClass?: string;
  bytes?: number | null;
  gb?: number | null;
  pricePerGbMonth?: number | null;
  monthlyUsd?: number | null;
}

export interface BackupCostEstimate {
  monthlyUsd?: number | null;
  estimatedMonthlyUsd?: number | null;
  complete?: boolean | null;
  partial?: boolean | null;
  measuredAt?: string | null;
  classes?: BackupCostClassEstimate[];
  coverage?: string | null;
  note?: string | null;
}

export interface BackupHistoryResponse {
  runs?: BackupRunSummary[];
  items?: BackupRunSummary[];
  history?: BackupRunSummary[];
  total?: number;
  limit?: number;
  offset?: number;
}

export interface BackupRunDetail extends BackupRunSummary {
  errors?: Array<string | Record<string, unknown>>;
  warnings?: Array<string | Record<string, unknown>>;
  limits?: Record<string, unknown> | null;
  integrity?: Record<string, unknown> | null;
}
