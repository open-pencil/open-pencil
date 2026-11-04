import { reactive, watch, type Ref, type WatchStopHandle } from 'vue'
import type { WebMCP } from 'webmcp-types'

import { getWebMCPTools } from './policy'
import {
  registerWebMCPTools,
  type WebMCPExecutionTarget,
  type WebMCPRegistration
} from './registration'
import { type WebMCPMode } from './schema'

export interface WebMCPRuntimeState {
  status: 'unsupported' | 'off' | 'starting' | 'ready' | 'error'
  toolCount: number
  error: string | null
}

/** Own browser registration lifetimes independently of the settings presentation. */
export function createWebMCPRuntimeService() {
  const state = reactive<WebMCPRuntimeState>({
    status: 'off',
    toolCount: 0,
    error: null
  })
  let stopWatch: WatchStopHandle | undefined
  let registration: WebMCPRegistration | undefined
  let version = 0
  let pending = Promise.resolve()

  function stop() {
    version++
    stopWatch?.()
    stopWatch = undefined
    registration?.dispose()
    registration = undefined
    state.status = 'off'
    state.toolCount = 0
    state.error = null
  }

  function start(
    context: Pick<WebMCP.ModelContext, 'registerTool'> | undefined,
    mode: Readonly<Ref<WebMCPMode>>,
    getTarget: () => WebMCPExecutionTarget
  ) {
    stop()
    stopWatch = watch(
      mode,
      (value) => {
        const request = ++version
        registration?.dispose()
        registration = undefined
        state.toolCount = 0
        state.error = null
        state.status = value === 'off' ? 'off' : 'starting'
        if (!context) state.status = 'unsupported'
        if (!context || value === 'off') return

        // Wait for any pending registerTool call to observe its aborted lifetime.
        async function configure() {
          if (request !== version) return
          const next = registerWebMCPTools(context, getTarget, value)
          registration = next
          try {
            await next.ready
            if (request !== version) return
            state.toolCount = getWebMCPTools(value).length
            state.status = 'ready'
          } catch (error) {
            if (request !== version) return
            state.status = 'error'
            state.error = error instanceof Error ? error.message : String(error)
          }
        }
        pending = pending.then(configure)
      },
      { immediate: true, flush: 'sync' }
    )
    return stop
  }

  return { state, start, stop }
}
