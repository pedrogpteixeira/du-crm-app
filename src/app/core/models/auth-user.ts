export interface UserTeam {
  id: string;
  name: string;
}

export interface UserPreferences {
  id?: string;
  userId?: string;
  sidebarCollapsedByDefault: boolean;
  repsolContractsDefaultView: 'table' | 'kanban';
  repsolContractDetailsCollapsedByDefault: boolean;
  contractLayout?: 'light' | 'pro';
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  active: boolean;
  defaultTeam: UserTeam | null;
  teams: UserTeam[];
  profilePicture?: string;
  preferences?: UserPreferences;
  createdAt?: string;
  lastAccess?: string;
  online?: boolean;
}