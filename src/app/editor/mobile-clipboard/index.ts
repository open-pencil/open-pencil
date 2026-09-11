import type { Editor } from '@open-pencil/core/editor'

import {
  getInMemoryClipboardHTML,
  setInMemoryClipboardPayload
} from '@/app/editor/clipboard/memory'
import { pasteClipboardHTML } from '@/app/editor/clipboard/paste'

/** Explicit in-app mobile clipboard; shares the same typed capture and paste dispatch. */
export function createMobileClipboardActions(editor: Editor) {
  async function mobileCopy(): Promise<boolean> {
    const payload = await editor.prepareCopy()
    if (!payload.html) return false
    setInMemoryClipboardPayload(payload)
    return true
  }

  async function mobileCut() {
    const selectedIds = new Set(editor.state.selectedIds)
    if (!(await mobileCopy())) return
    if (
      selectedIds.size !== editor.state.selectedIds.size ||
      [...selectedIds].some((id) => !editor.state.selectedIds.has(id))
    )
      return
    editor.deleteSelected()
  }

  async function mobilePaste() {
    const html = getInMemoryClipboardHTML()
    if (html) await pasteClipboardHTML(editor, html)
  }

  return { mobileCopy, mobileCut, mobilePaste }
}
