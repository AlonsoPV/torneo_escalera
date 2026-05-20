import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { tabFilterRows } from '@/components/admin/results/adminResultsReviewUtils'
import { getAdminResults } from '@/services/admin'

/** Partidos en `score_disputed` — misma bandeja que `/admin/notifications`. */
export function useAdminDisputeInboxCount() {
  const resultsQ = useQuery({ queryKey: ['admin-results'], queryFn: getAdminResults })

  const count = useMemo(() => {
    if (!resultsQ.data) return 0
    return tabFilterRows(resultsQ.data, 'disputed').length
  }, [resultsQ.data])

  return { count, isLoading: resultsQ.isLoading }
}
