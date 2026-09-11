import {
  formatCpe,
  formatCrc,
  formatCui,
  formatPhone,
  formatPortugueseIban,
  formatPostalCode,
  getContractFormValidationError,
  isValidCpe,
  isValidCrc,
  isValidCui,
  isValidEmail,
  isValidPhone,
  isValidPortugueseIban,
  isValidPostalCode,
} from './contract-field-formatting';

describe('contract field formatting', () => {
  it('formats CRC without duplicating separators', () => {
    expect(formatCrc('123456789012')).toBe('1234-5678-9012');
    expect(formatCrc('1234-5678-9012')).toBe('1234-5678-9012');
    expect(isValidCrc('1234-5678-9012')).toBeTrue();
  });

  it('formats Portuguese IBAN with groups and limits extra characters', () => {
    expect(formatPortugueseIban('PT50003300001234567890123')).toBe(
      'PT50 0033 0000 1234 5678 9012 3',
    );
    expect(isValidPortugueseIban('PT50 0033 0000 1234 5678 9012 3')).toBeTrue();
  });

  it('forces the CPE prefix and expected shape', () => {
    expect(formatCpe('pt0002123456789012aa')).toBe('PT 0002 123456789012 AA');
    expect(isValidCpe('PT 0002 123456789012 AA')).toBeTrue();
  });

  it('formats CUI, postal code and phone', () => {
    expect(formatCui('pt160112345678aa')).toBe('PT 1601 12345678 AA');
    expect(formatPostalCode('4510507')).toBe('4510-507');
    expect(formatPhone('912345678999')).toBe('912345678');

    expect(isValidCui('PT 1601 12345678 AA')).toBeTrue();
    expect(isValidPostalCode('4510-507')).toBeTrue();
    expect(isValidPhone('912345678')).toBeTrue();
  });

  it('validates emails and returns readable field errors', () => {
    expect(isValidEmail('user@example.com')).toBeTrue();
    expect(isValidEmail('userexample.com')).toBeFalse();

    expect(getContractFormValidationError({ telefone: '91234567' })).toBe(
      'O telefone deve ter exatamente 9 dígitos.',
    );
  });
});
