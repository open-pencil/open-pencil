import { tryOnScopeDispose } from '@vueuse/core'

export function useNativeMenuEvents(handler: (id: string) => void): void {
  let unlisten: (() => void) | undefined

  void import('@tauri-apps/api/event').then(({ listen }) => {
    return listen<string>('menu-event', (event) => {
      handler(event.payload)
    }).then((fn) => {
      unlisten = fn
      return undefined
    })
  })

  tryOnScopeDispose(() => unlisten?.())
}
