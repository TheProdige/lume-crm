import { useEffect } from 'react';

/**
 * Calls handler when Escape key is pressed.
 * Only fires when no input/textarea is focused.
 */
export function useEscapeKey(handler: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Blur the field first, next Escape will close
        (document.activeElement as HTMLElement)?.blur();
        return;
      }
      handler();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handler, active]);
}
