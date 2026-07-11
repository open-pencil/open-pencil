import { useLocalStorage } from '@vueuse/core'
import type { Ref } from 'vue'

import { readS3Config } from '@/app/cloud/credentials'

const MARKER_PREFIX = 'open-pencil:cloud:welcome-seeded:'

/** Per-bucket "already seeded / known environment" marker (ISO date, '' = unset). */
function seededMarker(): Ref<string> {
  const { endpoint, bucket } = readS3Config()
  return useLocalStorage(`${MARKER_PREFIX}${endpoint}|${bucket}`, '')
}

let seeding = false

/**
 * Seed a brand-new cloud environment (no remote and no local projects) with
 * the bundled Welcome project, once per bucket. Deleting it later does not
 * bring it back — the marker persists.
 *
 * ponytail: the marker is per-browser localStorage, so a fresh browser against
 * an emptied bucket re-seeds; store the marker in the bucket if that matters.
 */
export async function maybeSeedWelcomeProject(
  remoteCount: number,
  localCount: number
): Promise<boolean> {
  if (seeding) return false
  const marker = seededMarker()
  if (marker.value) return false
  if (remoteCount > 0 || localCount > 0) {
    // Existing environment — mark it so deleting every project later
    // doesn't respawn the Welcome file into a deliberately emptied bucket.
    marker.value = new Date().toISOString()
    return false
  }

  seeding = true
  try {
    const response = await fetch('/welcome.fig')
    if (!response.ok) return false
    const bytes = await response.arrayBuffer()
    const file = new File([bytes], 'Welcome.fig')

    // Dynamic import: tabs pulls in cloud modules, avoid an init cycle.
    const { importLocalFilesToCloud } = await import('@/app/tabs')
    const ids = await importLocalFilesToCloud([file])
    if (ids.length === 0) return false

    marker.value = new Date().toISOString()
    return true
  } catch (e) {
    console.warn('[Cloud] welcome project seed failed:', e)
    return false
  } finally {
    seeding = false
  }
}
