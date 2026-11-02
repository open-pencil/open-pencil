import { useDebounceFn } from '@vueuse/core'
import type { Ref } from 'vue'

import {
  DOCUMENT_FORMATS,
  USAGE_BATCH_LIMIT,
  type DocumentFormat,
  type Build,
  type Ping,
  type UsageBatch,
  type UsageEvent
} from '@lawha/feedback/contract'

import type { SharingPreferences } from '@/app/settings/preferences/store'

import type { SharingState } from './state'

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** A usage event as callers report it; the time is added when it is recorded. */
export type UsageEventInput = DistributiveOmit<UsageEvent, 'timestamp'>

export interface SharingClientOptions {
  /** Whether this build may send anything at all. */
  enabled: boolean
  preferences: () => SharingPreferences
  state: Ref<SharingState>
  build: () => Promise<Build>
  disabledByEnvironment: () => Promise<boolean>
  /** Sends to the feedback service and reports whether each request was accepted. */
  send: {
    ping: (ping: Ping) => Promise<boolean>
    ingest: (batch: UsageBatch, options: { keepalive?: boolean }) => Promise<boolean>
  }
  now?: () => Date
}

const FLUSH_DELAY_MS = 5_000
const FLUSH_MAX_WAIT_MS = 30_000

const isDocumentFormat = (format: string): format is DocumentFormat =>
  (DOCUMENT_FORMATS as readonly string[]).includes(format)

export function createSharingClient(options: SharingClientOptions) {
  const now = options.now ?? (() => new Date())
  const pending: UsageEvent[] = []

  function activeInstallId(): string | null {
    if (!options.enabled || options.preferences().usageStats !== 'granted') return null
    return options.state.value.installId
  }

  /**
   * Sends today's anonymous ping unless this install already did, the person turned it off, or
   * the build or environment sends nothing. A failed ping is retried on the next check.
   */
  async function sendDailyPing(): Promise<void> {
    if (!options.enabled || !options.preferences().dailyPing) return
    const day = now().toISOString().slice(0, 10)
    if (options.state.value.lastPingDay === day) return
    if (await options.disabledByEnvironment()) return
    const build = await options.build()
    // The person may have turned the ping off while the checks above were pending.
    const { dailyPing, usageStats } = options.preferences()
    if (!dailyPing) return
    const ping: Ping = { ...build, usageStats }
    if (await options.send.ping(ping)) {
      options.state.value = { ...options.state.value, lastPingDay: day }
    }
  }

  /** Sends what is queued; events that fail to send are dropped rather than piling up. */
  async function flushUsage(flush: { keepalive?: boolean } = {}): Promise<void> {
    if (await options.disabledByEnvironment()) {
      pending.length = 0
      return
    }
    while (pending.length > 0) {
      const build = await options.build()
      // Read after every wait, so stopping takes effect before the next request goes out.
      const installId = activeInstallId()
      if (!installId) {
        pending.length = 0
        return
      }
      const events = pending.splice(0, USAGE_BATCH_LIMIT)
      const batch: UsageBatch = { ...build, installId, events }
      await options.send.ingest(batch, flush)
    }
  }

  const scheduleFlush = useDebounceFn(() => flushUsage(), FLUSH_DELAY_MS, {
    maxWait: FLUSH_MAX_WAIT_MS
  })

  /** Records a usage event when the person agreed to share usage stats; otherwise does nothing. */
  function trackUsage(event: UsageEventInput): void {
    if (!activeInstallId()) return
    pending.push({ ...event, timestamp: now().toISOString() })
    void scheduleFlush()
  }

  /** Reports a file format by its IO format ID; formats off the shared list are not reported. */
  function trackDocumentFormat(name: 'document_opened' | 'document_exported', format: string) {
    if (isDocumentFormat(format)) trackUsage({ name, format })
  }

  return {
    sendDailyPing,
    flushUsage,
    trackUsage,
    trackDocumentFormat,
    /** Forgets queued events, for when the person stops sharing. */
    discardPendingUsage: () => {
      pending.length = 0
    }
  }
}

export type SharingClient = ReturnType<typeof createSharingClient>
