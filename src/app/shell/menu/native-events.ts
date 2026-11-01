import { listen } from '@tauri-apps/api/event'
import { tryOnScopeDispose } from '@vueuse/core'

export function useNativeMenuEvents(handler: (id: string) => void): void {
  let disposed = false
  let unlisten: (() => void) | undefined

  void listen<string>('menu-event', (event) => {
    handler(event.payload)
  }).then((fn) => {
    if (disposed) fn()
    else unlisten = fn
    return undefined
  })

  tryOnScopeDispose(() => {
    disposed = true
    unlisten?.()
    unlisten = undefined
  })
}
