import { useQuery } from '@tanstack/react-query';
import { getJulesStatus } from '../api/jules';

/**
 * Hook to check if Jules integration is configured, enabled, and reachable.
 * Used by App.tsx to conditionally show/hide the Jules menu item.
 * Cached for 5 minutes to avoid excessive API calls.
 */
export function useJulesStatus() {
  return useQuery({
    queryKey: ['jules-status'],
    queryFn: getJulesStatus,
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: false,
    refetchOnWindowFocus: false,
  });
}