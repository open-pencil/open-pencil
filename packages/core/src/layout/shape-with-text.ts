import { compact } from 'es-toolkit'

import { shapeWithTextFrameFields, shapeWithTextLabel } from '@open-pencil/scene-graph'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { fitShapeWithText } from '@open-pencil/scene-graph/shape-with-text'

import { estimateTextSize, getTextMeasurer } from './text-measurement'

function measureText(node: SceneNode, maxWidth?: number): { width: number; height: number } {
  return getTextMeasurer()?.(node, maxWidth) ?? estimateTextSize(node, maxWidth)
}

/** The size a shape with text was given: what a user or script last set, else its own. */
function givenSize(shape: SceneNode): { width: number; height: number } {
  return {
    width: shape.shapeUserWidth > 0 ? shape.shapeUserWidth : shape.width,
    height: shape.shapeUserHeight > 0 ? shape.shapeUserHeight : shape.height
  }
}

/**
 * The size and padding a shape with text takes for its label, as FigJam fits it (see
 * fitShapeWithText): its given size while the label fits, grown just enough when it does not.
 */
export function shapeWithTextFit(graph: SceneGraph, shape: SceneNode): Partial<SceneNode> {
  const given = givenSize(shape)
  const label = shapeWithTextLabel(graph, shape)
  let size = given
  if (label?.text) {
    const wrapping: SceneNode = { ...label, textAutoResize: 'HEIGHT' }
    const words = compact(label.text.split(/\s+/))
    const longestWord = Math.max(
      0,
      // A word is measured on one line, unwrapped, so its width is never capped by the label's.
      ...words.map(
        (word) =>
          measureText({ ...label, text: word, styleRuns: [], textAutoResize: 'WIDTH_AND_HEIGHT' })
            .width
      )
    )
    size = fitShapeWithText(shape.shapeWithTextType, {
      ...given,
      longestWord,
      measure: (maxWidth) => measureText({ ...wrapping, width: maxWidth }, maxWidth)
    })
  }
  return {
    ...size,
    ...shapeWithTextFrameFields(shape.shapeWithTextType, size.width, size.height)
  }
}

/** Fits a shape with text to its label before its auto layout places the label. */
export function fitShapeWithTextFrame(graph: SceneGraph, shape: SceneNode): void {
  if (shape.type !== 'SHAPE_WITH_TEXT') return
  const fit = shapeWithTextFit(graph, shape)
  const changes = Object.fromEntries(
    Object.entries(fit).filter(([key, value]) => Reflect.get(shape, key) !== value)
  )
  if (Object.keys(changes).length > 0) graph.updateNode(shape.id, changes)
}

const SHAPE_SIZE_KEYS: ReadonlySet<string> = new Set(['width', 'height'])

/**
 * A width or height set on a shape with text, by a resize or a script, is the size it was given;
 * layout grows it from there when its label needs more room.
 */
export function shapeWithTextSizeChanges(
  node: SceneNode,
  changes: Partial<SceneNode>
): Partial<Pick<SceneNode, 'shapeUserWidth' | 'shapeUserHeight'>> {
  if (node.type !== 'SHAPE_WITH_TEXT') return {}
  if (!Object.keys(changes).some((key) => SHAPE_SIZE_KEYS.has(key))) return {}
  // Changes that carry the given size themselves, such as an undo restoring it, keep theirs.
  const given: Partial<Pick<SceneNode, 'shapeUserWidth' | 'shapeUserHeight'>> = {}
  if (changes.width !== undefined && changes.shapeUserWidth === undefined) {
    given.shapeUserWidth = changes.width
  }
  if (changes.height !== undefined && changes.shapeUserHeight === undefined) {
    given.shapeUserHeight = changes.height
  }
  return given
}
