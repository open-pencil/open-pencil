import type { Editor } from '@open-pencil/core'
import { isSVGMarkup } from '@open-pencil/core/io/formats/svg'
import { detectMermaidDiagram } from '@open-pencil/mermaid'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { filesMessages } from '@open-pencil/vue/i18n'

import { toast } from '@/app/shell/ui'

import { matchingClipboardSnapshot } from '../memory'

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
export async function pasteSVGText(
  editor: Editor,
  text: string,
  cursorPos?: Vector
): Promise<boolean> {
  if (!isSVGMarkup(text)) return false
  const { x, y } = pastePoint(editor, cursorPos)
  return editor.pasteSVG(text, x, y)
}

/** Whether pasted text becomes layers of its own, as SVG markup and Mermaid diagrams do. */
export function isLayerText(text: string): boolean {
  return isSVGMarkup(text) || detectMermaidDiagram(text) !== null
}

/**
 * Paste a Mermaid flowchart as FigJam layers laid out around the point; false when the text is
 * not one. A flowchart Mermaid cannot read reports why, its first line being Mermaid's summary.
 */
export async function pasteMermaidText(
  editor: Editor,
  text: string,
  cursorPos?: Vector
): Promise<boolean> {
  if (!detectMermaidDiagram(text)) return false
  const { x, y } = pastePoint(editor, cursorPos)
  try {
    return await editor.pasteMermaid(text, x, y)
  } catch (error) {
    const reason = error instanceof Error ? (error.message.split('\n')[0] ?? '') : ''
    toast.error(filesMessages.get().mermaidPasteFailed({ error: reason }))
    return true
  }
}

/** Paste text that becomes layers of its own; false for any other text. */
export async function pasteLayerText(
  editor: Editor,
  text: string,
  cursorPos?: Vector
): Promise<boolean> {
  return (
    (await pasteSVGText(editor, text, cursorPos)) ||
    (await pasteMermaidText(editor, text, cursorPos))
  )
}
