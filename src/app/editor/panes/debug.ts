import { IS_BROWSER } from '@open-pencil/core/constants'

const DEBUG_LABEL = '[OpenPencil split-pane]'

export function isSplitPaneDebugEnabled(): boolean {
  if (!IS_BROWSER) return false
  try {
    return new URLSearchParams(window.location.search).get('splitPaneDebug') === '1'
  } catch {
    return false
  }
}

export function logSplitPaneDebug(event: string, data: Record<string, unknown> = {}): void {
  if (!isSplitPaneDebugEnabled()) return
  console.debug(DEBUG_LABEL, event, data)
}
