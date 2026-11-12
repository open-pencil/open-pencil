import type { Editor } from '@open-pencil/core'

/** How long navigation waits after its last input before it settles to idle. */
export const NAVIGATION_SETTLE_DELAY_MS = 120

export interface NavigationSettle {
  settle: () => void
  cancel: () => void
  dispose: () => void
}

interface SharedSettle {
  timer: ReturnType<typeof setTimeout> | null
  /** The controller whose settle is pending; a stale timer or disposal must not end a newer one. */
  owner: object | null
}

const sharedSettles = new WeakMap<Editor, SharedSettle>()

function sharedSettle(editor: Editor): SharedSettle {
  let shared = sharedSettles.get(editor)
  if (!shared) {
    shared = { timer: null, owner: null }
    sharedSettles.set(editor, shared)
  }
  return shared
}

/**
 * Marks navigation as settling, then idle once no gesture has come for `delayMs`. All controllers
 * of one editor share the pending settle, so a wheel timer cannot end a pan's newer settle.
 */
export function createNavigationSettle(
  editor: Editor,
  delayMs = NAVIGATION_SETTLE_DELAY_MS
): NavigationSettle {
  const token = {}
  const shared = sharedSettle(editor)

  function clearTimer() {
    if (shared.timer === null) return
    clearTimeout(shared.timer)
    shared.timer = null
  }

  /** A new gesture cancels whatever settle was pending, whichever controller started it. */
  function cancel() {
    clearTimer()
    shared.owner = null
  }

  function settle() {
    clearTimer()
    shared.owner = token
    editor.setNavigationPhase('settling')
    shared.timer = setTimeout(() => {
      shared.timer = null
      if (shared.owner !== token) return
      shared.owner = null
      if (editor.state.navigation.phase !== 'settling') return
      editor.setNavigationPhase('idle')
      editor.requestRepaint()
    }, delayMs)
  }

  /**
   * Stops a canvas from leaving navigation settling for good when it unmounts mid-gesture. A
   * newer gesture or settle that took the phase over keeps it.
   */
  function dispose() {
    if (shared.owner !== token) return
    const pending = shared.timer !== null
    cancel()
    if (!pending || editor.state.navigation.phase !== 'settling') return
    editor.setNavigationPhase('idle')
    editor.requestRepaint()
  }

  return { settle, cancel, dispose }
}
