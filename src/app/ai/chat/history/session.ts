import { watchThrottled } from '@vueuse/core'
import { watch } from 'vue'

import { toolChangesVersion } from '@/app/ai/tools/changes/store'

import type { HistoryChat } from './types'

/** Owns live subscriptions; a failed final save deliberately leaves the session attached. */
export function createHistorySession(reset: () => Promise<void>) {
  let live: HistoryChat | null = null
  let interrupted = false
  let generation = 0
  let stopWatch: (() => void) | undefined

  function attach(next: HistoryChat, flush: () => Promise<void>): void {
    if (live === next) return
    stopWatch?.()
    live = next
    const activeGeneration = ++generation
    function save() {
      if (live === next && generation === activeGeneration) void flush().catch(() => undefined)
    }
    const stopMessages = watchThrottled(() => next.messages, save, {
      deep: true,
      throttle: 500,
      trailing: true
    })
    const stopStatus = watch(
      () => next.status,
      () => {
        if (next.status === 'submitted') interrupted = false
        save()
      }
    )
    // Change previews render after their message settles; save them when they arrive.
    const stopChanges = watchThrottled(toolChangesVersion, save, { throttle: 500, trailing: true })
    stopWatch = () => {
      stopMessages()
      stopStatus()
      stopChanges()
    }
  }

  async function detach(flush: () => Promise<void>): Promise<void> {
    interrupted ||= live?.status === 'submitted' || live?.status === 'streaming'
    await live?.stop()
    await flush()
    generation++
    stopWatch?.()
    stopWatch = undefined
    await reset()
    live = null
  }

  return {
    attach,
    detach,
    get chat() {
      return live
    },
    get interrupted() {
      return interrupted || live?.status === 'submitted' || live?.status === 'streaming'
    },
    restoreInterrupted(value: boolean) {
      interrupted = value
    }
  }
}
