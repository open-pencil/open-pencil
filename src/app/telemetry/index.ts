import { useEventListener, useIntervalFn } from '@vueuse/core'

import { locale } from '@open-pencil/vue/i18n'

import { resolveUsageStatsQuestion } from './consent'
import { sharingClient } from './instance'

export {
  offerUsageStatsPrompt,
  setUsageStatsConsent,
  usageStatsConsent,
  usageStatsPrompt
} from './consent'
export type { UsageEventInput } from './client'

export const { trackUsage, trackDocumentFormat } = sharingClient

/** An app left open for days still pings once per day it is open. */
const PING_CHECK_INTERVAL_MS = 60 * 60 * 1000

let started = false

/** Starts the daily ping and records the launch; call once when the editor opens. */
export async function startSharing(): Promise<void> {
  if (started) return
  started = true
  await resolveUsageStatsQuestion()
  void sharingClient.sendDailyPing()
  useIntervalFn(() => void sharingClient.sendDailyPing(), PING_CHECK_INTERVAL_MS)
  // Closing the window sends what is queued instead of waiting for the next batch.
  useEventListener(window, 'pagehide', () => void sharingClient.flushUsage({ keepalive: true }))
  trackUsage({ name: 'app_opened', locale: locale.get() })
}
