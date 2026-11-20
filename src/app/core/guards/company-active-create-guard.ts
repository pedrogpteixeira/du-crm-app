import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import {
  getCompanyIdByContractProvider,
  getContractProviderFromCreateRoute,
} from '../config/contract-company';
import { clearContractDuplicateDraft } from '../utils/contract-duplicate';
import { CompanyService } from '../services/company';
import { ToastService } from '../services/toast';

const COMPANY_INACTIVE_MESSAGE =
  'Esta comercializadora está inativa e não permite a criação de novos contratos.';

export const companyActiveCreateGuard: CanActivateFn = (_route, state) => {
  const companyService = inject(CompanyService);
  const toast = inject(ToastService);
  const router = inject(Router);

  const provider = getContractProviderFromCreateRoute(state.url);
  const companyId = getCompanyIdByContractProvider(provider);

  if (!provider || !companyId) {
    return true;
  }

  return companyService.isCompanyActive(companyId).pipe(
    map((active) => {
      if (active) {
        return true;
      }

      clearContractDuplicateDraft();
      toast.warning(COMPANY_INACTIVE_MESSAGE);
      return router.createUrlTree([`/home/contracts/${provider}`]);
    }),
  );
};
