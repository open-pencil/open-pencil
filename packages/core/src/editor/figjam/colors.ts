import type { SceneNode } from '@open-pencil/scene-graph'
import {
  figJamLayerColorFields,
  figJamLineColorFields,
  figJamLineStyleFields,
  figJamSectionColorFields,
  figJamSectionColorName,
  type FigJamColorName,
  type FigJamLineStyle
} from '@open-pencil/scene-graph/figjam'
import { isGeneratedFrame } from '@open-pencil/scene-graph/generated'

import { recordSubtreeEdit } from '#core/editor/components/slots/history'
import { showsImage } from '#core/editor/figjam/toolbar'
import type { NodeActions } from '#core/editor/nodes'
import type { EditorContext } from '#core/editor/types'

/**
 * FigJam's colour and line menus for the layers that have no menu of their own: sections, text,
 * and plain shapes, lines, frames and groups. Sticky notes, shapes with text and connectors keep
 * their own commands.
 */
export function createFigJamColorActions(ctx: EditorContext, nodes: NodeActions) {
  function layersAmong(ids: Iterable<string>, accepts: (node: SceneNode) => boolean) {
    return [...ids].flatMap((id) => {
      const node = ctx.graph.getNode(id)
      return node && accepts(node) ? [node] : []
    })
  }

  function edit(label: string, layers: SceneNode[], change: (layer: SceneNode) => void) {
    if (layers.length === 0) return
    recordSubtreeEdit(
      ctx,
      label,
      layers.map((layer) => layer.id),
      () => layers.forEach(change)
    )
  }

  /** The layers a colour lands on: a group's contents, as FigJam colours a group. */
  function painted(layer: SceneNode): SceneNode[] {
    if (layer.type !== 'GROUP') return [layer]
    return ctx.graph.getChildren(layer.id).flatMap(painted)
  }

  /**
   * Paints the sections and plain layers among `ids` in palette colour `name`, as FigJam's colour
   * menu does: a section takes a pale tint outlined in the colour, other layers the colour itself.
   */
  function setFigJamColor(ids: Iterable<string>, name: FigJamColorName) {
    const layers = layersAmong(ids, (node) => !isGeneratedFrame(node))
    edit('Change color', layers, (layer) => {
      if (layer.type === 'SECTION') {
        nodes.updateNode(layer.id, figJamSectionColorFields(layer, name))
        return
      }
      // An image in a group keeps its picture, as a lone image has no colour menu.
      for (const target of painted(layer)) {
        if (!isGeneratedFrame(target) && !showsImage(target))
          nodes.updateNode(target.id, figJamLayerColorFields(target, name))
      }
    })
  }

  const isSection = (node: SceneNode) => node.type === 'SECTION'

  /** Gives a section without an outline the one its colour pairs with, so a line menu has one. */
  function outlined(section: SceneNode): SceneNode {
    if (section.strokes.length > 0) return section
    const fields = figJamSectionColorFields(section, figJamSectionColorName(section) ?? 'white')
    return { ...section, strokes: fields.strokes ?? [], strokeWeight: fields.strokeWeight ?? 0 }
  }

  /** Draws the sections' outlines solid, dashed, or not at all, as FigJam's line menu does. */
  function setSectionLineStyle(ids: Iterable<string>, style: FigJamLineStyle) {
    edit('Change section line', layersAmong(ids, isSection), (section) => {
      const current = outlined(section)
      nodes.updateNode(section.id, {
        strokeWeight: current.strokeWeight,
        ...figJamLineStyleFields(current, style)
      })
    })
  }

  /** Colours the sections' outlines in palette colour `name`. */
  function setSectionLineColor(ids: Iterable<string>, name: FigJamColorName) {
    edit('Change section line color', layersAmong(ids, isSection), (section) => {
      const current = outlined(section)
      nodes.updateNode(section.id, {
        strokeWeight: current.strokeWeight,
        ...figJamLineColorFields(current, name)
      })
    })
  }

  return { setFigJamColor, setSectionLineStyle, setSectionLineColor }
}
