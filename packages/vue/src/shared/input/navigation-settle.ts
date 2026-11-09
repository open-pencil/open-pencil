import type { Editor } from '@open-pencil/core'

/** How long navigation waits after its last input before it settles to idle. */
export const NAVIGATION_SETTLE_DELAY_MS = 120

export interface NavigationSettle {
  settle: () => void
  cancel: () => void
  dispose: () => void
}

/**
 * Marks navigation as settling, then idle once no gesture has come for `delayMs`. A gesture that
 * starts meanwhile sets its own phase, so the pending settle leaves it alone.
 */
export function createNavigationSettle(
  editor: Editor,
  delayMs = NAVIGATION_SETTLE_DELAY_MS
): NavigationSettle {
  let timer: ReturnType<typeof setTimeout> | null = null

  function cancel() {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  function settle() {
    cancel()
    editor.setNavigationPhase('settling')
    timer = setTimeout(() => {
      timer = null
      if (editor.state.navigation.phase !== 'settling') return
      editor.setNavigationPhase('idle')
      editor.requestRepaint()
    }, delayMs)
  }

  /**
   * Stops a canvas from leaving navigation settling for good when it unmounts mid-gesture. A
   * newer gesture that took the phase over keeps it.
   */
  function dispose() {
    const pending = timer !== null
    cancel()
    if (!pending || editor.state.navigation.phase !== 'settling') return
    editor.setNavigationPhase('idle')
    editor.requestRepaint()
  }

  return { settle, cancel, dispose }
}
