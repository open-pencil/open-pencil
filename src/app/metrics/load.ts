import * as v from 'valibot'
import { ref, shallowRef, watch, type Ref } from 'vue'

import { createFeedbackClient } from '@open-pencil/feedback/client'
import { metricsSnapshotSchema, type MetricsSnapshot } from '@open-pencil/feedback/contract'

import type { MetricsRange } from './range'

/**
 * The numbers for one range, from the feedback Worker that serves the page. It throws when the
 * request fails, which is also what happens once Access's session has run out: the API then
 * redirects to the login page, and reloading signs in again.
 */
export async function fetchMetricsSnapshot(range: MetricsRange): Promise<MetricsSnapshot> {
  const client = createFeedbackClient({ origin: globalThis.location.origin })
  const response = await client.admin.api.snapshot.$get({
    query: { start: range.start, end: range.end }
  })
  if (response.status !== 200) throw new Error(`The metrics API answered ${response.status}`)
  // Checked against the contract before use, as Cloud's client does with its answers.
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), metricsSnapshotSchema),
    await response.text()
  )
  if (!parsed.success) throw new Error('The metrics API sent an unexpected answer')
  return parsed.output
}

/**
 * The dashboard's numbers as the range changes, starting from the first snapshot the page was
 * mounted with. A newer request wins over one still in flight, and the last numbers stay on
 * screen while the next ones load or after a request fails.
 */
export function useMetricsSnapshot(range: Ref<MetricsRange>, first: MetricsSnapshot | undefined) {
  const snapshot = shallowRef(first)
  const loading = ref(false)
  const failed = ref(first === undefined)
  let latest = 0

  async function load() {
    const request = ++latest
    loading.value = true
    try {
      const next = await fetchMetricsSnapshot(range.value)
      if (request !== latest) return
      snapshot.value = next
      failed.value = false
    } catch (error) {
      if (request !== latest) return
      console.warn('Metrics could not load', error)
      failed.value = true
    } finally {
      if (request === latest) loading.value = false
    }
  }

  watch(range, load)
  return { snapshot, loading, failed, refresh: load }
}
