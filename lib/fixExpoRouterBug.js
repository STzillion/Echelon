// lib/fixExpoRouterBug.ts
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

// Temporary fix for expo-router crash after Supabase OAuth redirect
export function useSafeRouter() {
  const router = useRouter();

  useEffect(() => {
    try {
      const state = router.getState?.(); // safely try getState
      if (!state || !state.routes || !Array.isArray(state.routes)) {
        console.warn('Invalid router state detected. Skipping...');
        return;
      }
    } catch (e) {
      console.warn('Router state error:', e);
    }
  }, []);

  return router;
}
