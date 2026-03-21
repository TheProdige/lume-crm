import { useEffect, useState } from 'react';

type Status = 'idle' | 'loading' | 'ready' | 'error';

const SCRIPT_ID = 'google-maps-places-script';

/**
 * Loads the Google Maps JavaScript API (Places library) once globally.
 * Returns { isReady, isLoading, error }.
 */
export function useGoogleMapsScript() {
  const [status, setStatus] = useState<Status>('idle');
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  useEffect(() => {
    if (!apiKey) {
      setStatus('error');
      return;
    }

    // Already loaded (e.g. hot reload)
    try {
      if (typeof window !== 'undefined' && window.google?.maps?.places) {
        setStatus('ready');
        return;
      }
    } catch {
      // ignore
    }

    // Script already in DOM
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      // Wait for it to load
      const check = () => {
        try {
          if (window.google?.maps?.places) {
            setStatus('ready');
          }
        } catch {
          // still loading
        }
      };
      existing.addEventListener('load', check);
      check(); // maybe already loaded
      return () => existing.removeEventListener('load', check);
    }

    setStatus('loading');

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;

    script.onload = () => setStatus('ready');
    script.onerror = () => setStatus('error');

    document.head.appendChild(script);
  }, [apiKey]);

  return {
    isReady: status === 'ready',
    isLoading: status === 'loading' || status === 'idle',
    error: status === 'error',
  };
}
