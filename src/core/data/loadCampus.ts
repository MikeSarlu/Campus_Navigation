import type { CampusData } from './types';

export async function loadCampus(url = '/data/campus.json'): Promise<CampusData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
  return (await res.json()) as CampusData;
}
