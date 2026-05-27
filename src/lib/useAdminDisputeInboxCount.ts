import { useQuery } from '@tanstack/react-query'

import { getAdminDisputedResults } from '@/services/admin'

/** Refutaciones recientes: vuelven a `pending_score`, pero conservan `disputed_by` para la bandeja admin. */
export function useAdminDisputeInboxCount() {
  const resultsQ = useQuery({
    queryKey: ['admin-disputed-results'],
    queryFn: getAdminDisputedResults,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })

  const count = resultsQ.data?.length ?? 0

  return { count, isLoading: resultsQ.isLoading }
}
