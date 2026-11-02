import { sumBy } from 'es-toolkit'

import type { MetricsUsage } from '@open-pencil/feedback/contract'

/** Installs first seen on `cohort`, then how many opened the app again each day after. */
export type RetentionCohort = MetricsUsage['retention'][number]

export interface RetentionPoint {
  /** Days since an install was first seen; 0 is that first day. */
  day: number
  share: number
  /** How many installs the share is taken from. */
  installs: number
}

/**
 * Every first day pooled into one curve: on day N, the share of installs that came back, counted
 * only over first days at least N days old, so young cohorts don't pull the curve down.
 */
export function pooledRetention(cohorts: RetentionCohort[]): RetentionPoint[] {
  const longest = Math.max(0, ...cohorts.map((cohort) => cohort.values.length))
  const points: RetentionPoint[] = []
  for (let day = 0; day < longest; day++) {
    const reached = cohorts.filter((cohort) => cohort.values.length > day)
    const installs = sumBy(reached, (cohort) => cohort.values[0] ?? 0)
    if (!installs) continue
    points.push({
      day,
      share: sumBy(reached, (cohort) => cohort.values[day] ?? 0) / installs,
      installs
    })
  }
  return points
}
