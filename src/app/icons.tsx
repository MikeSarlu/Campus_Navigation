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
