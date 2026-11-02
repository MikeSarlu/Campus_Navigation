import { describe, expect, it } from 'vitest';
import { detectLanguage, translate } from './i18n';

describe('detectLanguage', () => {
  it.each([
    [['en-GB', 'es-MX'], 'en'],
    [['es-MX'], 'es'],
    [['de-DE', 'en-US'], 'en'],
    [['fr-FR', 'de'], 'es'],
    [[], 'es'],
  ] as const)('%j → %s', (languages, expected) => {
    expect(detectLanguage(languages)).toBe(expected);
  });
});

describe('translate', () => {
  it('sustituye parámetros', () => {
    expect(translate('en', 'data.summary', { places: 3, date: 'Nov 1' })).toBe('3 places · data from Nov 1');
  });
});
