import { useEffect, useRef } from 'react';

/**
 * Lleva el foco al elemento al aparecer, para que el lector de pantalla anuncie la vista nueva.
 * Sin esto el foco se pierde: el botón que se tocó (p. ej. un resultado) desaparece con la vista anterior.
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
