import { BLACK } from '../constants'
import { FIGJAM_TYPEFACES, figJamTextSizeFields } from '../figjam/text'
import type { SceneGraph } from '../index'
import { shapeWithTextLabelBox } from '../shape-with-text/fit'
import type { ShapeWithTextType } from '../shape-with-text/kinds'
import { lineHeightPixels } from '../text/lengths'
import type { Fill, SceneNode } from '../types'
import type { GeneratedFrameKind } from './kind'

/** FigJam makes a shape with text 176 px square, from its tool and from its plugin API. */
export const SHAPE_WITH_TEXT_SIZE = 176
/** FigJam rounds every corner of a shape by 6 px. */
export const SHAPE_WITH_TEXT_CORNER_RADIUS = 6

const LABEL_FILL: Fill = { type: 'SOLID', color: { ...BLACK }, opacity: 0.8, visible: true }

/** How the label sits in its shape: as wide as the label box, as tall as its text. */
export const SHAPE_WITH_TEXT_LABEL_LAYOUT = {
  textAutoResize: 'HEIGHT',
  layoutAlignSelf: 'STRETCH'
} as const satisfies Partial<SceneNode>

/**
 * The shape's own layout: a vertical auto layout that centres the label in the label box of its
 * kind, which the padding leaves free. The padding follows the kind and size, so it is set again
 * whenever either changes.
 */
export function shapeWithTextFrameFields(
  kind: ShapeWithTextType,
  width: number,
  height: number
): Partial<SceneNode> {
  const box = shapeWithTextLabelBox(kind, width, height)
  return {
    layoutMode: 'VERTICAL',
    primaryAxisAlign: 'CENTER',
    counterAxisAlign: 'CENTER',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    itemSpacing: 0,
    paddingTop: box.y,
    paddingRight: Math.max(0, width - box.x - box.width),
    paddingBottom: Math.max(0, height - box.y - box.height),
    paddingLeft: box.x,
    clipsContent: false
  }
}

/** The label's text style as FigJam starts it: Inter Medium at its Small size, black at 80%. */
export function shapeWithTextLabelFields(): Partial<SceneNode> {
  return {
    name: 'Text',
    fontFamily: FIGJAM_TYPEFACES.simple.fontFamily,
    fontWeight: FIGJAM_TYPEFACES.simple.fontWeight,
    ...figJamTextSizeFields('small'),
    textAlignHorizontal: 'CENTER',
    textAlignVertical: 'TOP',
    fills: [{ ...LABEL_FILL, color: { ...LABEL_FILL.color } }],
    ...SHAPE_WITH_TEXT_LABEL_LAYOUT
  }
}

/** A shape's label: its one text sublayer. */
export function shapeWithTextLabel(graph: SceneGraph, shape: SceneNode): SceneNode | null {
  if (shape.type !== 'SHAPE_WITH_TEXT') return null
  const children = graph.getChildren(shape.id)
  if (children.length !== 1) return null
  const [label] = children
  return label.type === 'TEXT' ? label : null
}

/**
 * A shape with text edits its label in place, turns and resizes freely, and, as in FigJam, takes
 * its name from its label until it is named. A height set on it by a resize, a field or a script
 * is the height it was given, which layout grows it from when its label needs more room; once
 * that height changes, FigJam keeps it and truncates the label instead.
 */
export const SHAPE_WITH_TEXT_KIND: GeneratedFrameKind = {
  complete: (graph, frame) => shapeWithTextLabel(graph, frame) !== null,
  text: (graph, frame) => shapeWithTextLabel(graph, frame) ?? undefined,
  rotates: true,
  resizes: true,
  strokesAndEffects: true,
  namedByText: true,
  sized: ({ height }, shape) =>
    height === undefined || height === shape.height
      ? {}
      : { shapeUserHeight: height, shapeTruncates: true }
}

/** Adds the label to a SHAPE_WITH_TEXT the caller created, styled as FigJam generates it. */
export function buildShapeWithTextLabel(
  graph: SceneGraph,
  shape: SceneNode,
  props: Partial<SceneNode> = {}
): SceneNode {
  const box = shapeWithTextLabelBox(shape.shapeWithTextType, shape.width, shape.height)
  const fields = shapeWithTextLabelFields()
  return graph.createNode('TEXT', shape.id, {
    ...fields,
    x: box.x,
    y: box.y,
    width: box.width,
    height: lineHeightPixels(fields.lineHeight ?? null, fields.fontSize ?? 0) ?? undefined,
    text: '',
    ...props
  })
}

/** A new shape with text and its label; the caller lays it out to grow it to its text. */
export function createShapeWithText(
  graph: SceneGraph,
  parentId: string,
  props: Partial<SceneNode> = {},
  label: Partial<SceneNode> = {}
): SceneNode {
  const kind = props.shapeWithTextType ?? 'SQUARE'
  const width = props.width ?? SHAPE_WITH_TEXT_SIZE
  const height = props.height ?? SHAPE_WITH_TEXT_SIZE
  const shape = graph.createNode('SHAPE_WITH_TEXT', parentId, {
    name: 'Shape with text',
    cornerRadius: SHAPE_WITH_TEXT_CORNER_RADIUS,
    ...props,
    shapeWithTextType: kind,
    width,
    height,
    shapeUserHeight: props.shapeUserHeight ?? height,
    ...shapeWithTextFrameFields(kind, width, height)
  })
  buildShapeWithTextLabel(graph, shape, label)
  return shape
}
