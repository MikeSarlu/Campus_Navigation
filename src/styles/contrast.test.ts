// Contraste de los pares texto/fondo de la app (docs/DISENO.md §7: objetivo WCAG AAA).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = Object.fromEntries(
  [...readFileSync('src/styles/tokens.css', 'utf8').matchAll(/(--color-[\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, k, v]) => [k, v]),
);
const v = (name: string) => tokens[`--color-${name}`] ?? name;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const MAP_BG = '#f1f1ec';

// [texto, fondo, dónde se usa]
const TEXT_PAIRS: [string, string, string][] = [
  ['text', 'bg', 'texto general'],
  ['text-secondary', 'bg', 'textos secundarios y ayudas'],
  ['on-accent', 'accent', 'botones principales (Caminar, Enviar)'],
  ['#ffffff', 'destination', 'botón Detener'],
  ['#ffffff', 'arrival', 'botón Llegué y pantalla de llegada'],
  ['destination', 'bg', 'avisos de error'],
  ['arrival', 'bg', 'estado "Enviado"'],
  ['#6b4700', 'bg', 'ubicación aproximada, estado "Borrador"'],
  ['text', '#fff4d6', 'notas del panel de destino'],
  ['#ffffff', '#3d3d3a', 'aviso sin conexión'],
  ['#ffffff', '#0b0b0b', 'avisos emergentes'],
  ['#ffffff', '#732cc4', 'aviso de vista previa del editor'],
  ['text', '#e8efff', 'indicación de piso'],
  ['#2b2b29', MAP_BG, 'nombres de calles en el mapa'],
];

describe('contraste AAA del texto (7:1)', () => {
  it.each(TEXT_PAIRS)('%s sobre %s (%s)', (fg, bg) => {
    expect(contrast(v(fg), v(bg))).toBeGreaterThanOrEqual(7);
  });
});

describe('contraste de elementos gráficos sobre el mapa (3:1)', () => {
  it.each([
    ['route', 'ruta'],
    ['destination', 'pin del destino'],
    ['#1a73e8', 'punto azul de ubicación'],
  ])('%s (%s)', (color) => {
    expect(contrast(v(color), MAP_BG)).toBeGreaterThanOrEqual(3);
  });
});
