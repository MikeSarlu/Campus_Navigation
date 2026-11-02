import { describe, expect, it } from 'vitest';
import { explainQuery, parseRoomCode } from './codes';
import type { Place } from './types';

const place = (id: string, siglas: string): Place => ({
  id, siglas, name: { es: id, en: id }, kind: 'building', categories: [], entranceNodeIds: [],
});

describe('parseRoomCode', () => {
  it.each(['CN-220', 'cn220', 'CN 220', ' Cn - 220 '])('normaliza %s', (input) => {
    expect(parseRoomCode(input)).toEqual({ siglas: 'CN', floor: 2, code: 'CN-220' });
  });

  it('toma el piso del primer dígito', () => {
    expect(parseRoomCode('CN-120')?.floor).toBe(1);
    expect(parseRoomCode('IA-251')?.floor).toBe(2);
  });

  it('acepta siglas con dígitos solo con guion', () => {
    expect(parseRoomCode('1-120')).toEqual({ siglas: '1', floor: 1, code: '1-120' });
    expect(parseRoomCode('1120')).toBeNull();
  });

  it.each(['CN', 'CN-22', 'CN-220A', 'biblioteca', ''])('rechaza %s', (input) => {
    expect(parseRoomCode(input)).toBeNull();
  });
});

describe('explainQuery', () => {
  const places = [place('humanidades', 'HU'), place('asuntos', 'HU'), place('ciencias', 'CN'), place('ios', 'iOS')];

  it('explica las siglas de un código con su piso', () => {
    expect(explainQuery('cn220', places)).toMatchObject({ siglas: 'CN', floor: 2, places: [{ id: 'ciencias' }] });
  });

  it('devuelve todos los lugares con siglas repetidas', () => {
    expect(explainQuery('HU', places)?.places.map((p) => p.id)).toEqual(['humanidades', 'asuntos']);
  });

  it('no distingue mayúsculas en las siglas', () => {
    expect(explainQuery('ios', places)?.places[0].id).toBe('ios');
  });

  it('ignora consultas que no son siglas conocidas', () => {
    expect(explainQuery('ZZ', places)).toBeNull();
    expect(explainQuery('biblioteca', places)).toBeNull();
  });
});
