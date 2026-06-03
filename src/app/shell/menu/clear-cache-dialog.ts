import { ref } from 'vue'

/**
 * Tiny reactive controller for the "Clear cached document" confirmation
 * modal. The menu action sets `open` to true and waits for the user to
 * confirm or cancel via the Vue dialog (no window.confirm).
 */
const open = ref(false)
let resolveDecision: ((confirmed: boolean) => void) | null = null

export function useClearCacheDialog() {
  return { open }
}

export function requestClearCacheConfirmation(): Promise<boolean> {
  if (open.value) {
    // Already showing, reuse the pending promise instead of stacking dialogs.
    return new Promise<boolean>((resolve) => {
      const previous = resolveDecision
      resolveDecision = (value) => {
        previous?.(value)
        resolve(value)
      }
    })
  }
  open.value = true
  return new Promise<boolean>((resolve) => {
    resolveDecision = resolve
  })
}

export function resolveClearCacheDialog(confirmed: boolean): void {
  open.value = false
  resolveDecision?.(confirmed)
  resolveDecision = null
}
