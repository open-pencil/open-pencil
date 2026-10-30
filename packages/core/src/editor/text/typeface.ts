import {
  FIGJAM_TYPEFACES,
  figJamTypefaceFields,
  type FigJamTypeface
} from '@open-pencil/scene-graph/figjam'
import { faceLoadKey } from '@open-pencil/scene-graph/font-style'
import { generatedFrameText } from '@open-pencil/scene-graph/generated'

import { recordSubtreeEdit } from '#core/editor/components/slots/history'
import type { EditorContext } from '#core/editor/types'

/** Typefaces for the text generated frames are named by, such as a sticky note's body or a shape's label. */
export function createGeneratedTextActions(ctx: EditorContext) {
  /**
   * Sets the text that sticky notes and shapes among `ids` are named by in one of FigJam's
   * typefaces, once its face is loaded.
   */
  async function setGeneratedTextTypeface(ids: Iterable<string>, typeface: FigJamTypeface) {
    const { fontFamily, fontWeight } = FIGJAM_TYPEFACES[typeface]
    await ctx.loadFont(fontFamily, faceLoadKey(fontWeight, false))
    const frames = [...ids].flatMap((id) => {
      const node = ctx.graph.getNode(id)
      return node && generatedFrameText(ctx.graph, node) ? [node] : []
    })
    if (frames.length === 0) return
    recordSubtreeEdit(
      ctx,
      'Change typeface',
      frames.map((frame) => frame.id),
      () => {
        for (const frame of frames) {
          const text = generatedFrameText(ctx.graph, frame)
          if (text) ctx.graph.updateNode(text.id, figJamTypefaceFields(typeface, text))
        }
      }
    )
  }

  return { setGeneratedTextTypeface }
}
