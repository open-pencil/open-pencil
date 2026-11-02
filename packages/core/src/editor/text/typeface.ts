import type { SceneNode } from '@open-pencil/scene-graph'
import {
  FIGJAM_TYPEFACES,
  figJamTextSizeFields,
  figJamTextSize,
  figJamTypeface,
  figJamTypefaceFaceFields,
  type FigJamTextSize,
  type FigJamTypeface
} from '@open-pencil/scene-graph/figjam'
import { faceLoadKey } from '@open-pencil/scene-graph/font-style'
import { generatedFrameText } from '@open-pencil/scene-graph/generated'

import { recordSubtreeEdit } from '#core/editor/components/slots/history'
import type { NodeActions } from '#core/editor/nodes'
import type { EditorContext } from '#core/editor/types'
import { textStyleChanges } from '#core/text/character-style'

/** How sticky notes and shapes take a FigJam size: each fits itself to its text as it does. */
interface GeneratedTextSizes {
  setStickyTextSize: (ids: Iterable<string>, size: FigJamTextSize) => void
  setShapesWithTextTextSize: (ids: Iterable<string>, size: FigJamTextSize) => void
}

/**
 * FigJam's typefaces and text sizes for text layers and for the text generated frames are named
 * by, such as a sticky note's body or a shape's label, in any mix of them.
 */
export function createFigJamTextActions(
  ctx: EditorContext,
  nodes: NodeActions,
  generated: GeneratedTextSizes
) {
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
    const graph = ctx.graph
    await ctx.loadFont(fontFamily, faceLoadKey(fontWeight, false))
    // Another document opened while the face loaded: these ids are not its layers.
    if (ctx.graph !== graph) return
    // The face replaces any a range keeps; ranges keep their own sizes, as the size menu sets those.
    edit('Change typeface', textsAmong(ids), (text) =>
      nodes.updateNode(text.id, {
        ...textStyleChanges(text, figJamTypefaceFaceFields(typeface)),
        ...figJamTextSizeFields(figJamTextSize(text), typeface)
      })
    )
  }

  /**
   * Sets the text of the layers among `ids` to one of FigJam's sizes, in its typeface, in one undo
   * step: text layers directly, and sticky notes and shapes as their own commands size them.
   */
  function setFigJamTextSize(ids: Iterable<string>, size: FigJamTextSize) {
    const targets = textsAmong(ids)
    const idsOf = (type: SceneNode['type']) =>
      targets.filter(({ layer }) => layer.type === type).map(({ layer }) => layer.id)
    ctx.undo.runBatch('Change text size', () => {
      edit(
        'Change text size',
        targets.filter(({ layer }) => layer.type === 'TEXT'),
        (text) =>
          nodes.updateNode(
            text.id,
            textStyleChanges(text, figJamTextSizeFields(size, figJamTypeface(text) ?? 'simple'))
          )
      )
      generated.setStickyTextSize(idsOf('STICKY'), size)
      generated.setShapesWithTextTextSize(idsOf('SHAPE_WITH_TEXT'), size)
    })
  }

  return { setFigJamTypeface, setFigJamTextSize }
}
