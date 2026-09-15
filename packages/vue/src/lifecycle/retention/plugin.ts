import { getCurrentScope, nextTick, onActivated, onBeforeUnmount, onDeactivated } from 'vue'
import type { Plugin } from 'vue'

import { installRetainedScopes, useRetainedActivity } from './context'

/**
 * Installs per-component suspension inside explicitly opted-in KeepAlive trees.
 * Vue component scopes are detached: pausing only the root leaves children running.
 * Requires Vue's Options API (enabled by default) for the beforeCreate mixin hook.
 */
export function createRetainedScopePlugin(): Plugin {
  return {
    install(app) {
      installRetainedScopes(app)
      app.mixin({
        beforeCreate() {
          const active = useRetainedActivity()
          const scope = getCurrentScope()
          if (!active || !scope) return
          let generation = 0
          onDeactivated(() => {
            const ticket = ++generation
            // Let cancellation and popup cleanup render once before suspending.
            void nextTick(() => {
              if (ticket === generation && !active.value && scope.active) scope.pause()
            })
          })
          onActivated(() => {
            generation++
            scope.resume()
          })
          onBeforeUnmount(() => {
            generation++
          })
        }
      })
    }
  }
}
