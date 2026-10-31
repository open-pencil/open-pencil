import type { SceneNode } from '@open-pencil/scene-graph'
import {
  FIGJAM_TYPEFACES,
  figJamTextSizeFields,
  figJamTypeface,
  figJamTypefaceFields,
  type FigJamTextSize,
  type FigJamTypeface
} from '@open-pencil/scene-graph/figjam'
import { faceLoadKey } from '@open-pencil/scene-graph/font-style'
import { generatedFrameText } from '@open-pencil/scene-graph/generated'

import { recordSubtreeEdit } from '#core/editor/components/slots/history'
import type { NodeActions } from '#core/editor/nodes'
import type { EditorContext } from '#core/editor/types'

/**
 * FigJam's typefaces and text sizes for text layers and for the text generated frames are named
 * by, such as a sticky note's body or a shape's label.
 */
export function createFigJamTextActions(ctx: EditorContext, nodes: NodeActions) {
  /** The layers among `ids` FigJam's text menus change, with the text each one sets. */
  function textsAmong(ids: Iterable<string>) {
    return [...ids].flatMap((id) => {
      const layer = ctx.graph.getNode(id)
      if (!layer) return []
      const text = layer.type === 'TEXT' ? layer : generatedFrameText(ctx.graph, layer)
      return text ? [{ layer, text }] : []
    })
  }

  function edit(
    label: string,
    targets: { layer: SceneNode; text: SceneNode }[],
    change: (text: SceneNode) => void
  ) {
    if (targets.length === 0) return
    recordSubtreeEdit(
      ctx,
      label,
      targets.map(({ layer }) => layer.id),
      () => targets.forEach(({ text }) => change(text))
    )
  }

  /**
   * Sets the text layers among `ids`, and the text sticky notes and shapes among them are named
   * by, in one of FigJam's typefaces, once its face is loaded.
   */
  async function setFigJamTypeface(ids: Iterable<string>, typeface: FigJamTypeface) {
    const { fontFamily, fontWeight } = FIGJAM_TYPEFACES[typeface]
    await ctx.loadFont(fontFamily, faceLoadKey(fontWeight, false))
    edit('Change typeface', textsAmong(ids), (text) =>
      nodes.updateNode(text.id, figJamTypefaceFields(typeface, text))
    )
  }

  /**
   * Sets the text layers among `ids` to one of FigJam's sizes, in their typeface. Sticky notes and
   * shapes size their text with their own commands, which also fit the layer to it.
   */
  function setFigJamTextSize(ids: Iterable<string>, size: FigJamTextSize) {
    const texts = textsAmong(ids).filter(({ layer }) => layer.type === 'TEXT')
    edit('Change text size', texts, (text) =>
      nodes.updateNode(text.id, figJamTextSizeFields(size, figJamTypeface(text) ?? 'simple'))
    )
  }

  return { setFigJamTypeface, setFigJamTextSize }
}
