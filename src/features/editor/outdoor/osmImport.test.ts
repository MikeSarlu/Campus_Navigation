import { describe, expect, it } from 'vitest';
import { clipToTile, joinTouching } from './osmImport';

describe('clipToTile', () => {
  it('recorta un tramo que sale de la tesela justo en el borde', () => {
    expect(clipToTile([4000, 100], [4200, 100], 4096)).toEqual([[4000, 100], [4096, 100]]);
  });

  it('descarta tramos fuera de la tesela', () => {
    expect(clipToTile([4100, 0], [4200, 50], 4096)).toBeNull();
  });
});

describe('joinTouching', () => {
  const keys = (segs: [number, number][][]) => segs.map(([a, b]) => `${a.join(',')}→${b.join(',')}`).sort();

  it('parte dos tramos que se cruzan en "X"', () => {
    const out = joinTouching([[[0, 10], [20, 10]], [[10, 0], [10, 20]]], 3);
    expect(keys(out)).toEqual(['0,10→10,10', '10,0→10,10', '10,10→10,20', '10,10→20,10']);
  });

  it('une una punta que casi toca otro tramo', () => {
    const out = joinTouching([[[0, 10], [20, 10]], [[10, 0], [10, 8]]], 3);
    expect(keys(out)).toEqual(['0,10→10,10', '10,0→10,8', '10,10→20,10', '10,8→10,10']);
  });

  it('no toca tramos que ya comparten vértice', () => {
    const segs: [number, number][][] = [[[0, 0], [10, 0]], [[10, 0], [10, 10]]];
    expect(joinTouching(segs as never, 3)).toEqual(segs);
  });
});
