import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumber,
  getExampleNumber,
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/examples.mobile.json';

const regionNames =
  typeof Intl !== 'undefined' && Intl.DisplayNames
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

export function countryName(iso2) {
  if (!iso2) return '';
  if (regionNames) {
    const name = regionNames.of(iso2);
    if (name) return name;
  }
  return iso2;
}

const countryOptionsCache = new Map();

export function getCountryOptions() {
  const key = 'default';
  if (!countryOptionsCache.has(key)) {
    const options = getCountries()
      .map((iso2) => ({
        iso2,
        name: countryName(iso2),
        callingCode: getCountryCallingCode(iso2),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    countryOptionsCache.set(key, options);
  }
  return countryOptionsCache.get(key);
}

export function getCountryByIso2(iso2) {
  return getCountryOptions().find((c) => c.iso2 === iso2) || null;
}

const exampleCache = new Map();

export function getNationalExample(iso2) {
  if (exampleCache.has(iso2)) return exampleCache.get(iso2);
  let example = '';
  try {
    const number = getExampleNumber(iso2, examples);
    if (number) example = number.formatNational();
  } catch {
    example = '';
  }
  exampleCache.set(iso2, example);
  return example;
}

export function isValidNationalNumber(value, iso2) {
  const trimmed = String(value || '').trim();
  if (!trimmed || !iso2) return false;
  try {
    const parsed = parsePhoneNumber(trimmed, iso2);
    if (!parsed) return false;
    // Require the number to actually belong to the selected country so the
    // validation really is country-aware (a full international number for
    // another country does not get a free pass).
    if (parsed.isValid() && parsed.country === iso2) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function toE164(value, iso2) {
  const trimmed = String(value || '').trim();
  try {
    const parsed = parsePhoneNumber(trimmed, iso2);
    if (parsed && parsed.number) return parsed.number;
  } catch {
    // fall through to manual reconstruction
  }
  const digits = trimmed.replace(/\D/g, '');
  return digits ? `+${getCountryCallingCode(iso2)}${digits}` : '';
}