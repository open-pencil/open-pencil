import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  SHAPE_WITH_TEXT_LABEL_LAYOUT,
  shapeWithTextFrameFields,
  shapeWithTextLabel
} from '@open-pencil/scene-graph/generated'
import {
  fitShapeWithTextHeight,
  shapeWithTextLabelBox
} from '@open-pencil/scene-graph/shape-with-text'

import { measureTextForLayout } from './text-measurement'

/** The height a shape with text was given: what a user or script last set, else its own. */
function givenHeight(shape: SceneNode): number {
  return shape.shapeUserHeight > 0 ? shape.shapeUserHeight : shape.height
}

/**
 * The height and padding a shape with text takes for its label, as FigJam fits it (see
 * fitShapeWithTextHeight). A shape whose height was set keeps it (`shapeTruncates`).
 */
export function shapeWithTextFit(graph: SceneGraph, shape: SceneNode): Partial<SceneNode> {
  const label = shapeWithTextLabel(graph, shape)
  let height = shape.shapeTruncates ? shape.height : givenHeight(shape)
  if (label?.text && !shape.shapeTruncates) {
    height = fitShapeWithTextHeight(shape.shapeWithTextType, shape.width, height, (maxWidth) =>
      measureTextForLayout(wholeText(label, maxWidth), maxWidth)
    )
  }
  return { height, ...shapeWithTextFrameFields(shape.shapeWithTextType, shape.width, height) }
}

/** Wider than any label lays out, for measuring one on a single line. */
const UNWRAPPED = 100_000

/**
 * The narrowest whole width, from `min` to `max`, whose label box holds the shape's label in lines
 * no wider than `lineWidth`, with the height `heightFor` gives each width. The label wraps past
 * `lineWidth`, and the shape's fit then makes it taller.
 */
export function shapeWithTextWidthFor(
  graph: SceneGraph,
  shape: SceneNode,
  { min, max, lineWidth }: { min: number; max: number; lineWidth: number },
  heightFor: (width: number) => number = () => shape.height
): number {
  const label = shapeWithTextLabel(graph, shape)
  if (!label?.text) return min
  const natural = measureTextForLayout(wholeText(label, UNWRAPPED), UNWRAPPED).width
  const needed = Math.min(Math.ceil(natural), lineWidth)
  const holds = (width: number) =>
    shapeWithTextLabelBox(shape.shapeWithTextType, width, heightFor(width)).width >= needed
  if (holds(min)) return min
  if (!holds(max)) return max
  let low = min
  let high = max
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (holds(middle)) high = middle
    else low = middle
  }
  return high
}

/** A label's whole text wrapped at `width`, not cut short by a truncation it already has. */
function wholeText(label: SceneNode, width: number): SceneNode {
  return {
    ...label,
    ...SHAPE_WITH_TEXT_LABEL_LAYOUT,
    textTruncation: 'DISABLED',
    maxLines: null,
    width
  }
}

/**
 * How a shape's label sits in its label box: as tall as its text, or, in a shape that keeps its
 * height, cut to the box with "…" when the text runs past it, as FigJam truncates it.
 */
function labelFit(shape: SceneNode, label: SceneNode): Partial<SceneNode> {
  const whole = { ...SHAPE_WITH_TEXT_LABEL_LAYOUT, textTruncation: 'DISABLED' } as const
  if (!shape.shapeTruncates || !label.text) return whole
  const box = shapeWithTextLabelBox(shape.shapeWithTextType, shape.width, shape.height)
  if (measureTextForLayout(wholeText(label, box.width), box.width).height <= box.height)
    return whole
  return { textAutoResize: 'NONE', height: box.height, textTruncation: 'ENDING' }
}

/** Fits a shape with text and its label before its auto layout places the label. */
export function fitShapeWithTextFrame(graph: SceneGraph, shape: SceneNode): void {
  if (shape.type !== 'SHAPE_WITH_TEXT') return
  updateChanged(graph, shape, shapeWithTextFit(graph, shape))
  const fitted = graph.getNode(shape.id)
  const label = fitted && shapeWithTextLabel(graph, fitted)
  if (fitted && label) updateChanged(graph, label, labelFit(fitted, label))
}

/** Writes only the fields that differ, so a shape that already fits records no change. */
function updateChanged(graph: SceneGraph, node: SceneNode, fields: Partial<SceneNode>): void {
  const changes = Object.fromEntries(
    Object.entries(fields).filter(([key, value]) => Reflect.get(node, key) !== value)
  )
  if (Object.keys(changes).length > 0) graph.updateNode(node.id, changes)
}
