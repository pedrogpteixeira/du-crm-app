export interface UserCompanyCommission {
  id: string;
  userId: string;
  companyId: string;
  commissionPercentage: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserCompanyCommissionRequest {
  userId: string;
  companyId: string;
  commissionPercentage: number;
}

export interface UpdateUserCompanyCommissionRequest {
  commissionPercentage: number;
}