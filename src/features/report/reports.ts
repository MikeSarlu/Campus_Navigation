// Reportes de salones faltantes. En el prototipo el envío es simulado: se guardan en el
// teléfono, como borrador sin conexión y como "enviado" con conexión (docs/DISENO.md §6.10).
import { create } from 'zustand';
import type { LngLat } from '../../core/data/types';

export interface Report {
  id: string;
  code: string;
  /** Lugar (edificio) elegido en el formulario. */
  placeId?: string;
  floor?: number;
  details?: string;
  location?: LngLat;
  createdAt: string;
  status: 'draft' | 'sent';
}

const KEY = 'campus.reports';

function read(): Report[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(stored) ? (stored as Report[]) : [];
  } catch {
    return [];
  }
}

function write(reports: Report[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(reports));
  } catch {
    /* sin almacenamiento: el reporte vive solo mientras la app está abierta */
  }
}

/** crypto.randomUUID solo existe con https o localhost; al probar por la red local (http) no. */
function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface ReportsState {
  reports: Report[];
  submit: (r: Omit<Report, 'id' | 'createdAt' | 'status'>, online: boolean) => Report;
  /** Al volver la conexión, "envía" los borradores. Devuelve cuántos se enviaron. */
  sendDrafts: () => number;
}

export const useReports = create<ReportsState>((set, get) => ({
  reports: read(),
  submit: (r, online) => {
    const report: Report = { ...r, id: newId(), createdAt: new Date().toISOString(), status: online ? 'sent' : 'draft' };
    const reports = [report, ...get().reports];
    write(reports);
    set({ reports });
    return report;
  },
  sendDrafts: () => {
    const drafts = get().reports.filter((r) => r.status === 'draft').length;
    if (!drafts) return 0;
    const reports = get().reports.map((r) => ({ ...r, status: 'sent' as const }));
    write(reports);
    set({ reports });
    return drafts;
  },
}));
