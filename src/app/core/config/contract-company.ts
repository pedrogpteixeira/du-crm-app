import type { ClientContractProvider } from '../services/client';

export const CONTRACT_COMPANY_IDS: Readonly<Record<ClientContractProvider, string>> = {
  repsol: 'cmp_njRqliQBpR',
  portulogos: 'cmp_2AH_yvQ8Wn',
  'portulogos-b2b': 'cmp_8rkornAQ4H',
  'ezu-b2b': 'cmp_cYTHohh7uo',
  'nossa-energia-b2b': 'cmp_s4mjPGw-gJ',
  'audax-b2b': 'cmp_r26ycsfqpu',
  'plenitude-b2b': 'cmp_KXGnjPcbx-',
  'endesa-b2b': 'cmp_4xFQ0RiwtJ',
  wallbox: 'cmp_StOnumtpT5',
  'yes-energy': 'cmp_1GdwakqCnA',
  'galp-power-gas': 'cmp_Q5MgNAInW6',
  'galp-solar': 'cmp_qZUMPp-x7f',
  'edp-power-gas': 'cmp_ijGIgzDUrA',
  'edp-solar': 'cmp_yH50RBtMbI',
  iberdrola: 'cmp_JHtuvY63fm',
  'iberdrola-solar': 'cmp_FKsS04kTr7',
  'meo-energias': 'cmp_KCnjrA0i-U',
  vodafone: 'cmp_UL2eeL1SvE',
};

const PROVIDERS = Object.keys(CONTRACT_COMPANY_IDS) as ClientContractProvider[];

export function getCompanyIdByContractProvider(
  provider: ClientContractProvider | string | null | undefined,
): string | null {
  if (!provider || !(provider in CONTRACT_COMPANY_IDS)) {
    return null;
  }

  return CONTRACT_COMPANY_IDS[provider as ClientContractProvider];
}

export function getContractProviderFromUrl(url: string): ClientContractProvider | null {
  const match = url.match(/\/api\/contracts\/([^/?#]+)\/?(?:[?#].*)?$/i);
  const provider = match?.[1] ?? '';

  return PROVIDERS.includes(provider as ClientContractProvider)
    ? (provider as ClientContractProvider)
    : null;
}

export function getContractProviderFromCreateRoute(url: string): ClientContractProvider | null {
  const path = url.split(/[?#]/, 1)[0] ?? '';
  const match = path.match(/\/contracts\/([^/]+)\/create\/?$/i);
  const provider = match?.[1] ?? '';

  return PROVIDERS.includes(provider as ClientContractProvider)
    ? (provider as ClientContractProvider)
    : null;
}
