import type { SceneNode } from '@open-pencil/scene-graph'
import {
  figJamColorName,
  figJamFillMode,
  figJamLineColorFields,
  figJamLineStyleFields,
  figJamShapePaint,
  figJamTextSizeFields,
  figJamTypeface,
  type FigJamColorName,
  type FigJamFillMode,
  type FigJamLineStyle,
  type FigJamTextSize
} from '@open-pencil/scene-graph/figjam'
import { shapeWithTextFrameFields, shapeWithTextLabel } from '@open-pencil/scene-graph/generated'
import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'

import { recordSubtreeEdit } from '#core/editor/components/slots/history'
import type { NodeActions } from '#core/editor/nodes'
import type { EditorContext } from '#core/editor/types'
import { textStyleChanges } from '#core/text/character-style'

const FILL_OPACITY: Record<FigJamFillMode, number> = { fill: 1, transparent: 0.5, none: 0 }

/**
 * Shape-with-text commands: the kind the tool places, and the kind, colours, outline and text of
 * shapes already placed, as FigJam's selection toolbar sets them. Each change records the
 * shapes' whole subtrees as one step, since the label changes with the shape.
 */
export function createShapeWithTextActions(ctx: EditorContext, nodes: NodeActions) {
  function shapesAmong(ids: Iterable<string>): SceneNode[] {
    return [...ids].flatMap((id) => {
      const node = ctx.graph.getNode(id)
      return node?.type === 'SHAPE_WITH_TEXT' ? [node] : []
    })
  }

  function editShapes(label: string, ids: Iterable<string>, change: (shape: SceneNode) => void) {
    const shapes = shapesAmong(ids)
    if (shapes.length === 0) return
    recordSubtreeEdit(
      ctx,
      label,
      shapes.map((shape) => shape.id),
      () => shapes.forEach(change)
    )
  }

  /** Makes `kind` the one the shape tool places, as picking it in FigJam's Shapes panel does. */
  function setShapeWithTextKind(kind: ShapeWithTextType) {
    ctx.state.shapeWithTextKind = kind
  }

  /**
   * Turns the shapes with text among `ids` into `kind`, keeping their size, as FigJam's shape
   * switcher does; each lays its label out in the new kind's label area.
   */
  function changeShapesWithTextKind(ids: Iterable<string>, kind: ShapeWithTextType) {
    const changing = shapesAmong(ids).filter((shape) => shape.shapeWithTextType !== kind)
    editShapes(
      'Change shape',
      changing.map((shape) => shape.id),
      (shape) => {
        nodes.updateNode(shape.id, {
          shapeWithTextType: kind,
          ...shapeWithTextFrameFields(kind, shape.width, shape.height)
        })
      }
    )
  }

  function paint(shape: SceneNode, name: FigJamColorName, mode: FigJamFillMode) {
    const label = shapeWithTextLabel(ctx.graph, shape)
    const painted = figJamShapePaint(shape, label, name, mode)
    nodes.updateNode(shape.id, painted.shape)
    if (label) nodes.updateNode(label.id, painted.label)
  }

  /**
   * Paints the shapes in palette colour `name`. A see-through fill stays see-through, and a shape
   * without fill is filled again.
   */
  function setShapesWithTextColor(ids: Iterable<string>, name: FigJamColorName) {
    editShapes('Change shape color', ids, (shape) => {
      const mode = figJamFillMode(shape.fills.at(0))
      paint(shape, name, mode === 'none' ? 'fill' : mode)
    })
  }

  /** Fills the shapes solid, see-through, or not at all, keeping their colour. */
  function setShapesWithTextFillMode(ids: Iterable<string>, mode: FigJamFillMode) {
    editShapes('Change shape fill', ids, (shape) => {
      const fill = shape.fills.at(0)
      const name = figJamColorName(fill?.color)
      if (name) paint(shape, name, mode)
      else if (fill) {
        nodes.updateNode(shape.id, {
          fills: [{ ...fill, opacity: FILL_OPACITY[mode] }, ...shape.fills.slice(1)]
        })
      }
    })
  }

  /** Draws the shapes' outlines solid, dashed, or not at all. */
  function setShapesWithTextLineStyle(ids: Iterable<string>, style: FigJamLineStyle) {
    editShapes('Change shape line', ids, (shape) =>
      nodes.updateNode(shape.id, figJamLineStyleFields(shape, style))
    )
  }

  /** Colours the shapes' outlines in palette colour `name`, which later fills leave alone. */
  function setShapesWithTextLineColor(ids: Iterable<string>, name: FigJamColorName) {
    editShapes('Change shape line color', ids, (shape) =>
      nodes.updateNode(shape.id, figJamLineColorFields(shape, name))
    )
  }

  /** Sets the shapes' label text to one of FigJam's sizes; each grows or shrinks to fit it. */
  function setShapesWithTextTextSize(ids: Iterable<string>, size: FigJamTextSize) {
    editShapes('Change shape text size', ids, (shape) => {
      const label = shapeWithTextLabel(ctx.graph, shape)
      if (label) {
        // Characters sized on their own take the size too, as text layers do.
        nodes.updateNode(
          label.id,
          textStyleChanges(label, figJamTextSizeFields(size, figJamTypeface(label) ?? 'simple'))
        )
      }
    })
  }

  return {
    setShapeWithTextKind,
    changeShapesWithTextKind,
    setShapesWithTextColor,
    setShapesWithTextFillMode,
    setShapesWithTextLineStyle,
    setShapesWithTextLineColor,
    setShapesWithTextTextSize
  }
}
