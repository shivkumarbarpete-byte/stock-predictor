import { useEffect, useRef } from 'react';

/**
 * Custom hook to poll an async or sync callback at a specified interval.
 *
 * Features:
 * - Calls callback immediately on mount / when enabled
 * - Pauses polling when document.hidden is true (tab inactive)
 * - Resumes on tab focus with an immediate refresh
 * - Skips a tick if the previous callback invocation is still running (avoids overlapping calls)
 * - Cleans up intervals and event listeners on unmount
 *
 * @param {() => Promise<void> | void} callback
 * @param {number} intervalMs - Polling interval in ms (e.g. 30000 or 120000)
 * @param {{ enabled?: boolean }} [options]
 */
export function usePolling(callback, intervalMs, { enabled = true } = {}) {
  const savedCallback = useRef(callback);
  const isFetchingRef = useRef(false);

  // Keep latest callback reference
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !intervalMs || intervalMs <= 0) return;

    let timerId = null;

    const execute = async () => {
      if (document.hidden) return; // Do not fetch if tab hidden
      if (isFetchingRef.current) return; // Skip tick if previous request in flight

      isFetchingRef.current = true;
      try {
        if (savedCallback.current) {
          await savedCallback.current();
        }
      } catch (err) {
        console.error('Polling error:', err);
      } finally {
        isFetchingRef.current = false;
      }
    };

    // Immediate run
    execute();

    // Start interval
    timerId = setInterval(() => {
      execute();
    }, intervalMs);

    // Handle tab visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible again — trigger immediate refresh
        execute();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerId) clearInterval(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
