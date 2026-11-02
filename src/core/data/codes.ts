import type { Place } from './types';

export interface RoomCode {
  siglas: string;
  /** Primer dígito del número: CN-220 → piso 2. */
  floor: number;
  code: string;
}

// Con guion las siglas pueden llevar dígitos (edificio "1"); sin guion solo letras,
// para que "1120" no sea ambiguo.
const WITH_HYPHEN = /^([A-Z0-9]{1,4})\s*-\s*(\d{3,})$/;
const WITHOUT_HYPHEN = /^([A-Z]{1,4})\s*(\d{3,})$/;

export function normalizeQuery(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Reconoce "CN-220", "cn220" o "CN 220". Devuelve null si no es un código de salón. */
export function parseRoomCode(input: string): RoomCode | null {
  const q = normalizeQuery(input);
  const m = WITH_HYPHEN.exec(q) ?? WITHOUT_HYPHEN.exec(q);
  if (!m) return null;
  const [, siglas, digits] = m;
  return { siglas, floor: Number(digits[0]), code: `${siglas}-${digits}` };
}

/** Lugares cuyas siglas coinciden (sin distinguir mayúsculas). Puede haber varios. */
export function placesForSiglas(siglas: string, places: Place[]): Place[] {
  const key = siglas.toUpperCase();
  return places.filter((p) => p.siglas?.toUpperCase() === key);
}

export interface Explanation {
  siglas: string;
  places: Place[];
  floor?: number;
}

/** Explicación de abreviatura para lo que el usuario está escribiendo, si aplica. */
export function explainQuery(input: string, places: Place[]): Explanation | null {
  const code = parseRoomCode(input);
  if (code) {
    const matches = placesForSiglas(code.siglas, places);
    return matches.length ? { siglas: code.siglas, places: matches, floor: code.floor } : null;
  }
  const q = normalizeQuery(input).replace(/-$/, '');
  if (!/^[A-Z0-9]{1,4}$/.test(q)) return null;
  const matches = placesForSiglas(q, places);
  return matches.length ? { siglas: q, places: matches } : null;
}
