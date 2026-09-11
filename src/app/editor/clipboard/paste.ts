import type { Editor } from '@open-pencil/core/editor'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { matchingClipboardSnapshot } from './memory'

export async function pasteClipboardHTML(
  editor: Editor,
  html: string,
  cursorPos?: Vector,
  options: Parameters<Editor['pasteFromHTML']>[2] = {}
): Promise<void> {
  const snapshot = matchingClipboardSnapshot(html)
  if (snapshot) await editor.pasteSnapshot(snapshot, cursorPos, options)
  else await editor.pasteFromHTML(html, cursorPos, options)
}
