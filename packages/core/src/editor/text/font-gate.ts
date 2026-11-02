import type { SceneNode } from '@open-pencil/scene-graph'

import { isNodeFontLoaded } from '#core/canvas/text'
import type { FontReadinessRenderer } from '#core/canvas/text/renderer'
import type { EditorContext } from '#core/editor/types'
import { resolveEditorProfile } from '#core/editor/views/profile'
import { prepareTextFonts } from '#core/text/prepare'

/** What the gate reads from the canvas: whether it can measure a text, and its own fonts. */
type GateCanvas = FontReadinessRenderer & {
  fontsLoaded: boolean
  whenFontsLoaded(): Promise<void>
}

type GateContext = Pick<EditorContext, 'graph' | 'state' | 'loadFont'> & {
  getRenderer: () => GateCanvas | null
}

/**
 * How the editor's writes wait for the fonts of the text they leave. A write lands once the
 * canvas can measure that text in its own fonts, as Figma applies a font only once it has loaded
 * it: at once when they are in, otherwise after `prepareTextFonts`.
 */
export interface TextFontGate {
  /**
   * Runs `apply` once `texts`, the text layers as the write leaves them, can be measured in their
   * own fonts. Writes to the same `ids` land in order; one still waiting when the document is
   * replaced or becomes read-only is dropped, since it was meant for the document before.
   */
  write(ids: readonly string[], texts: () => readonly SceneNode[], apply: () => void): void
  /** The write to `id` still waiting for its fonts, if any, settling once it lands. */
  settled(id: string): Promise<void> | null
}

export function createTextFontGate(ctx: GateContext): TextFontGate {
  const waiting = new Map<string, Promise<void>>()

  /** The layers among `texts` the canvas cannot measure yet. Without a canvas, none: layout estimates. */
  function unprepared(texts: readonly SceneNode[]): SceneNode[] {
    const renderer = ctx.getRenderer()
    if (!renderer) return []
    return texts.filter(
      (text) =>
        text.type === 'TEXT' &&
        text.text !== '' &&
        (!renderer.fontsLoaded || !isNodeFontLoaded(renderer, text))
    )
  }

  function write(ids: readonly string[], texts: () => readonly SceneNode[], apply: () => void) {
    const before = ids.flatMap((id) => waiting.get(id) ?? [])
    if (before.length === 0 && unprepared(texts()).length === 0) {
      apply()
      return
    }
    const graph = ctx.graph
    const writable = () => ctx.graph === graph && resolveEditorProfile(ctx.state).edits
    const applyWhenPrepared = async () => {
      await Promise.all(before)
      const renderer = ctx.getRenderer()
      if (renderer && !renderer.fontsLoaded) await renderer.whenFontsLoaded()
      if (!writable()) return
      const needed = unprepared(texts())
      if (needed.length > 0) await prepareTextFonts(needed, { loadFont: ctx.loadFont })
      if (writable()) apply()
    }
    const settled = applyWhenPrepared().finally(() => {
      for (const id of ids) if (waiting.get(id) === settled) waiting.delete(id)
    })
    for (const id of ids) waiting.set(id, settled)
  }

  return { write, settled: (id) => waiting.get(id) ?? null }
}
