import type { Editor } from '@open-pencil/core/editor'
import { isSVGMarkup } from '@open-pencil/core/io'
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

/** Where a paste without a copied position goes: the cursor, else the middle of the view. */
export function pastePoint(editor: Editor, cursorPos?: Vector): Vector {
  const { panX, panY, zoom } = editor.state
  return (
    cursorPos ?? {
      x: (-panX + window.innerWidth / 2) / zoom,
      y: (-panY + window.innerHeight / 2) / zoom
    }
  )
}

/** Paste SVG markup, such as Figma's Copy as SVG, as layers; false when the text is not SVG. */
export function pasteSVGText(editor: Editor, text: string, cursorPos?: Vector): boolean {
  if (!isSVGMarkup(text)) return false
  const { x, y } = pastePoint(editor, cursorPos)
  return editor.pasteSVG(text, x, y)
}
