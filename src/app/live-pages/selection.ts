import { shallowRef } from 'vue'

import type { LiveSelection } from './schema'

/** The element a page reported, kept with the frame whose page was picked in. */
const reported = shallowRef<{ nodeId: string; selection: LiveSelection } | null>(null)

/**
 * The element last picked inside a page, and which frame picked it. Two frames can show the same
 * application, so a pick belongs to the frame it came from rather than to the panel: showing it
 * under another frame would name the wrong part of the document.
 */
export function useLivePageSelection() {
  function setSelection(nodeId: string, next: LiveSelection | null): void {
    reported.value = next === null ? null : { nodeId, selection: next }
  }

  /** What that frame reported, or null when it reported nothing. */
  function selectionOf(nodeId: string | null): LiveSelection | null {
    const current = reported.value
    return current?.nodeId === nodeId ? current.selection : null
  }

  return { reported, setSelection, selectionOf }
}
