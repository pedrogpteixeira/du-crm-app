import {
  formatCpe,
  formatCrc,
  formatCui,
  formatPhone,
  formatInternationalIban,
  formatPortugueseIban,
  formatPostalCode,
  getContractFormValidationError,
  isValidCpe,
  isValidCrc,
  isValidCui,
  isValidEmail,
  isValidPhone,
  isValidInternationalIban,
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

  it('formats and validates international IBANs without forcing PT', () => {
    expect(formatInternationalIban('DE89370400440532013000')).toBe(
      'DE89 3704 0044 0532 0130 00',
    );
    expect(isValidInternationalIban('DE89 3704 0044 0532 0130 00')).toBeTrue();
    expect(isValidInternationalIban('DE89 3704 0044 0532 0130 01')).toBeFalse();
  });

  it('forces the CPE prefix and accepts complete or suffix-only pasted values', () => {
    expect(formatCpe('pt0002123456789012aa')).toBe('PT 0002 123456789012 AA');
    expect(formatCpe('PT 0002 123456789012 AA')).toBe('PT 0002 123456789012 AA');
    expect(formatCpe('123456789012AA')).toBe('PT 0002 123456789012 AA');
    expect(isValidCpe('PT 0002 123456789012 AA')).toBeTrue();
  });

  it('formats CUI, postal code and phone', () => {
    expect(formatCui('pt160112345678aa')).toBe('PT 1601 12345678 AA');
    expect(formatCui('PT 1601 12345678 AA')).toBe('PT 1601 12345678 AA');
    expect(formatCui('160112345678AA')).toBe('PT 1601 12345678 AA');
    expect(formatPostalCode('4510507')).toBe('4510-507');
    expect(formatPhone('912345678999')).toBe('912345678');

    expect(isValidCui('PT 1601 12345678 AA')).toBeTrue();
    expect(isValidPostalCode('4510-507')).toBeTrue();
    expect(isValidPhone('912345678')).toBeTrue();
  });

  it('uses international IBAN validation only when explicitly requested', () => {
    expect(
      getContractFormValidationError(
        { iban: 'DE89 3704 0044 0532 0130 00' },
        { ibanMode: 'international' },
      ),
    ).toBeNull();

    expect(getContractFormValidationError({ iban: 'DE89 3704 0044 0532 0130 00' })).toBe(
      'O IBAN deve seguir o formato PT50 0033 0000 1234 5678 9012 3.',
    );
  });

  it('validates emails and returns readable field errors', () => {
    expect(isValidEmail('user@example.com')).toBeTrue();
    expect(isValidEmail('userexample.com')).toBeFalse();

    expect(getContractFormValidationError({ telefone: '91234567' })).toBe(
      'O telefone deve ter exatamente 9 dígitos.',
    );
  });
});
