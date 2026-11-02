import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CampusData } from './data/types';
import { normalize, placesInCategory, search, type SearchResult } from './search';

const campus = (): CampusData => JSON.parse(readFileSync('public/data/campus.json', 'utf8')) as CampusData;

const withRoom = (): CampusData => {
  const d = campus();
  const cn = d.buildings.find((b) => b.siglas === 'CN')!;
  cn.floors.push({ level: 2, outline: [], rooms: [{ code: 'CN-220', polygon: [], doorNodeId: 'door' }, { code: 'CN-221', polygon: [], doorNodeId: 'door2' }] });
  return d;
};

const label = (r: SearchResult) => (r.type === 'room' ? r.code : r.type === 'building' ? `→${r.place.siglas}` : r.place.name.es);

describe('search', () => {
  it('normaliza acentos y mayúsculas', () => {
    expect(normalize('  Ingenierías  2 ')).toBe('ingenierias 2');
  });

  it('encuentra un salón por código escrito de distintas formas', () => {
    for (const q of ['CN-220', 'cn220', 'cn 220']) expect(label(search(q, withRoom()).results[0])).toBe('CN-220');
  });

  it('un código parcial lista los salones que empiezan así', () => {
    expect(search('CN-22', withRoom()).results.map(label).slice(0, 2)).toEqual(['CN-220', 'CN-221']);
  });

  it('si el salón no está levantado ofrece ir a su edificio y explica las siglas', () => {
    const out = search('IA-251', campus());
    expect(label(out.results[0])).toBe('→IA');
    expect(out.explanation).toMatchObject({ siglas: 'IA', floor: 2 });
  });

  it('busca por nombre sin acentos', () => {
    expect(label(search('ingenierias', campus()).results[0])).toBe('Ingenierías-2');
    expect(label(search('biblio', campus()).results[0])).toBe('Biblioteca');
  });

  it('busca por nombre en inglés', () => {
    expect(label(search('library', campus()).results[0])).toBe('Biblioteca');
  });

  it('siglas repetidas devuelven todos sus lugares', () => {
    const names = search('HU', campus()).results.slice(0, 3).map(label).sort();
    expect(names).toEqual(['Asuntos Internacionales', 'Humanidades-31', 'UDLAP Consultores']);
  });

  it('sin coincidencias no devuelve nada', () => {
    expect(search('zzzz', campus()).results).toEqual([]);
  });
});

describe('placesInCategory', () => {
  it('ordena por distancia cuando hay ubicación', () => {
    const d = campus();
    const [ga, gb, gc] = ['GA', 'GB', 'GC'].map((s) => d.places.find((p) => p.siglas === s)!);
    ga.location = [-98.280, 19.050];
    gb.location = [-98.290, 19.050];
    gc.location = [-98.285, 19.050];
    expect(placesInCategory('gimnasio', d, [-98.291, 19.050]).map((p) => p.siglas)).toEqual(['GB', 'GC', 'GA']);
  });

  it('el comedor es solo el comedor universitario', () => {
    expect(placesInCategory('comedor', campus()).map((p) => p.name.es)).toEqual(['Comedor Universitario']);
  });
});
