// Íconos de trazo simple. Siempre acompañados de texto (docs/DISENO.md §7).
import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const SearchIcon = () => (
  <Icon><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>
);
/** Flecha de la maniobra para la instrucción de navegación. */
export function TurnIcon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    start: 'M12 20V5M6 11l6-6 6 6',
    left: 'M18 20v-7a3 3 0 0 0-3-3H6M10 6l-4 4 4 4',
    right: 'M6 20v-7a3 3 0 0 1 3-3h9M14 6l4 4-4 4',
    slightLeft: 'M15 20v-6L7 6M7 12V6h6',
    slightRight: 'M9 20v-6l8-8M17 12V6h-6',
    uturn: 'M8 20V9a4 4 0 0 1 8 0v4M12 10l4 4 4-4',
    arrive: 'M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    enter: 'M4 21V4h11v17M15 12H9M12 9l-3 3 3 3M15 4l5 2v15h-5',
  };
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[kind] ?? paths.start} />
    </svg>
  );
}

export const BackIcon = () => (
  <Icon><path d="M15 5 8 12l7 7M8 12h12" /></Icon>
);
export const ClearIcon = () => (
  <Icon><path d="M18 6 6 18M6 6l12 12" /></Icon>
);
export const LanguageIcon = () => (
  <Icon><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Icon>
);
export const CompassIcon = () => (
  <Icon><circle cx="12" cy="12" r="9" /><path d="m12 6 3 7h-6z" fill="currentColor" /></Icon>
);
export const LocateIcon = () => (
  <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></Icon>
);
