export type ContractFieldMask = 'crc' | 'iban' | 'cpe' | 'cui' | 'postalCode' | 'phone' | 'email';

export interface ContractFormValidationOptions {
  validateCpe?: boolean;
  validateCui?: boolean;
}

const CPE_PREFIX = 'PT 0002';
const CUI_PREFIX = 'PT';

function digitsOnly(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

function lettersOnly(value: unknown): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

export function formatCrc(value: unknown): string {
  const digits = digitsOnly(value).slice(0, 12);
  return digits.match(/.{1,4}/g)?.join('-') ?? '';
}

export function formatPortugueseIban(value: unknown): string {
  const raw = String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!raw) {
    return '';
  }

  const withoutCountry = raw.startsWith('PT') ? raw.slice(2) : raw;
  const digits = digitsOnly(withoutCountry).slice(0, 23);
  const compact = `PT${digits}`;

  return compact.match(/.{1,4}/g)?.join(' ') ?? compact;
}

export function formatCpe(value: unknown): string {
  const raw = String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  let payload = raw.startsWith('PT') ? raw.slice(2) : raw;

  if (payload.startsWith('0002')) {
    payload = payload.slice(4);
  }

  const digits = digitsOnly(payload).slice(0, 12);
  const letters = lettersOnly(payload).slice(0, 2);

  if (!digits) {
    return CPE_PREFIX;
  }

  return `${CPE_PREFIX} ${digits}${letters ? ` ${letters}` : ''}`;
}

export function formatCui(value: unknown): string {
  const raw = String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const payload = raw.startsWith('PT') ? raw.slice(2) : raw;
  const digits = digitsOnly(payload).slice(0, 12);
  const letters = lettersOnly(payload).slice(0, 2);

  if (!digits) {
    return CUI_PREFIX;
  }

  const networkCode = digits.slice(0, 4);
  const identifier = digits.slice(4, 12);

  return [CUI_PREFIX, networkCode, identifier, letters].filter(Boolean).join(' ');
}

export function formatPostalCode(value: unknown): string {
  const digits = digitsOnly(value).slice(0, 7);

  if (digits.length <= 4) {
    return digits;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export function formatPhone(value: unknown): string {
  return digitsOnly(value).slice(0, 9);
}

export function formatContractField(mask: ContractFieldMask, value: unknown): string {
  switch (mask) {
    case 'crc':
      return formatCrc(value);
    case 'iban':
      return formatPortugueseIban(value);
    case 'cpe':
      return formatCpe(value);
    case 'cui':
      return formatCui(value);
    case 'postalCode':
      return formatPostalCode(value);
    case 'phone':
      return formatPhone(value);
    case 'email':
      return String(value ?? '').replace(/\s/g, '');
  }
}

export function isValidCrc(value: unknown): boolean {
  const normalized = formatCrc(value);
  return /^\d{4}-\d{4}-\d{4}$/.test(normalized);
}

export function isValidPortugueseIban(value: unknown): boolean {
  const normalized = formatPortugueseIban(value);
  return /^PT\d{2}(?: \d{4}){5} \d$/.test(normalized);
}

export function isValidCpe(value: unknown): boolean {
  const normalized = formatCpe(value);
  return /^PT 0002 \d{12} [A-Z]{2}$/.test(normalized);
}

export function isValidCui(value: unknown): boolean {
  const normalized = formatCui(value);
  return /^PT \d{4} \d{8} [A-Z]{2}$/.test(normalized);
}

export function isValidPostalCode(value: unknown): boolean {
  return /^\d{4}-\d{3}$/.test(formatPostalCode(value));
}

export function isValidPhone(value: unknown): boolean {
  return /^\d{9}$/.test(formatPhone(value));
}

export function isValidEmail(value: unknown): boolean {
  const email = String(value ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hasValue(value: unknown): boolean {
  return String(value ?? '').trim().length > 0;
}

/**
 * Validação transversal dos campos de identificação/contacto usados nos
 * formulários de contratos. Todos os campos são opcionais aqui; a obrigação
 * de preenchimento continua a ser responsabilidade de cada comercializadora.
 */
export function getContractFormValidationError(
  form: Record<string, unknown>,
  options: ContractFormValidationOptions = {},
): string | null {
  if (hasValue(form['telefone']) && !isValidPhone(form['telefone'])) {
    return 'O telefone deve ter exatamente 9 dígitos.';
  }

  if (hasValue(form['email']) && !isValidEmail(form['email'])) {
    return 'Indique um email válido.';
  }

  if (hasValue(form['crc']) && !isValidCrc(form['crc'])) {
    return 'O CRC deve seguir o formato 1234-5678-9012.';
  }

  if (hasValue(form['iban']) && !isValidPortugueseIban(form['iban'])) {
    return 'O IBAN deve seguir o formato PT50 0033 0000 1234 5678 9012 3.';
  }

  const installationPostalCode = form['moradaInstalacaoCodigoPostal'];
  if (hasValue(installationPostalCode) && !isValidPostalCode(installationPostalCode)) {
    return 'O código postal da morada de instalação deve seguir o formato 4510-507.';
  }

  const billingPostalCode = form['moradaFaturacaoCodigoPostal'];
  if (hasValue(billingPostalCode) && !isValidPostalCode(billingPostalCode)) {
    return 'O código postal da morada de faturação deve seguir o formato 4510-507.';
  }

  if (options.validateCpe && !isValidCpe(form['cpe'])) {
    return 'O CPE deve seguir o formato PT 0002 123456789012 AA.';
  }

  if (options.validateCui && !isValidCui(form['cui'])) {
    return 'O CUI deve seguir o formato PT 1601 12345678 AA.';
  }

  return null;
}
