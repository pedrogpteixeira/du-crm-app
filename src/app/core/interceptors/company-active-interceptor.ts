import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import {
  getCompanyIdByContractProvider,
  getContractProviderFromUrl,
} from '../config/contract-company';
import { CompanyService } from '../services/company';

const COMPANY_INACTIVE_CODE = 'COMPANY_INACTIVE';
const COMPANY_INACTIVE_MESSAGE =
  'Não é possível criar contratos numa comercializadora desativada.';

export const companyActiveInterceptor: HttpInterceptorFn = (request, next) => {
  const companyService = inject(CompanyService);
  const provider =
    request.method === 'POST' ? getContractProviderFromUrl(request.urlWithParams) : null;
  const companyId = getCompanyIdByContractProvider(provider);

  if (companyId && companyService.getCompanyActiveSnapshot(companyId) === false) {
    return throwError(
      () =>
        new HttpErrorResponse({
          status: 409,
          statusText: 'Conflict',
          url: request.urlWithParams,
          error: {
            code: COMPANY_INACTIVE_CODE,
            message: COMPANY_INACTIVE_MESSAGE,
          },
        }),
    );
  }

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        companyId &&
        error instanceof HttpErrorResponse &&
        error.status === 409 &&
        error.error?.code === COMPANY_INACTIVE_CODE
      ) {
        companyService.markCompanyInactive(companyId);
      }

      return throwError(() => error);
    }),
  );
};
