import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  createShapeWithText,
  SHAPE_WITH_TEXT_CORNER_RADIUS,
  SHAPE_WITH_TEXT_SIZE,
  shapeWithTextLabel
} from '@open-pencil/scene-graph/generated'

import { SHAPE_KIND } from '../enums'
import { collectFillProps, collectStrokeProps } from '../export/paints'
import type { JSXProp } from '../export/value'
import { readElementProps, shapePropsSchema } from '../schema'
import { plainTextOf, type TreeNode } from '../tree'
import { figJamTextFields, figJamTextProps } from './text'

/**
 * `<Shape kind="diamond" bg="#FFC943">Decide</Shape>`: a FigJam shape with text, made from the
 * same template as the shape tool's. Its text is the label.
 */
export const SHAPE_ELEMENT = 'shape'

/**
 * The shape an element describes, with `layer`'s fields; it is named by its label, as FigJam
 * names a shape, until given a name.
 */
export function renderShapeNode(
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string,
  layer: Partial<SceneNode>
) {
  const props = readElementProps(shapePropsSchema, tree.props)
  const text = plainTextOf(tree)
  const shape = createShapeWithText(
    graph,
    parentId,
    {
      ...layer,
      name: layer.name ?? (text.trim() || 'Shape with text'),
      autoRename: !layer.name,
      shapeWithTextType: props.kind ?? 'SQUARE',
      shapeTruncates: props.truncate ?? false
    },
    { text }
  )
  const label = shapeWithTextLabel(graph, shape)
  if (label) graph.updateNode(label.id, figJamTextFields(label, props.textSize, props.typeface))
  return shape
}

/**
 * A shape's own props as `<Shape>` writes them, after its name and position: the height it was
 * given rather than the height its label grew it to, so it grows the same way when read back.
 */
export function shapeWithTextProps(graph: SceneGraph, node: SceneNode): JSXProp[] {
  const props: JSXProp[] = []
  if (node.shapeWithTextType !== 'SQUARE') {
    props.push(['kind', SHAPE_KIND.print(node.shapeWithTextType)])
  }
  const label = shapeWithTextLabel(graph, node)
  if (label) props.push(...figJamTextProps(label))
  // A truncating shape keeps the height it has; any other grows from the height it was given.
  const height =
    !node.shapeTruncates && node.shapeUserHeight > 0 ? node.shapeUserHeight : node.height
  if (node.width !== SHAPE_WITH_TEXT_SIZE) props.push(['w', node.width])
  if (height !== SHAPE_WITH_TEXT_SIZE) props.push(['h', height])
  if (node.shapeTruncates) props.push(['truncate', true])
  if (node.rotation !== 0) props.push(['rotate', Math.round(node.rotation * 100) / 100])
  collectFillProps(node, props)
  collectStrokeProps(node, props)
  if (node.cornerRadius !== SHAPE_WITH_TEXT_CORNER_RADIUS)
    props.push(['rounded', node.cornerRadius])
  return props
}

/** The label a shape writes as its children. */
export function shapeWithTextLabelText(graph: SceneGraph, node: SceneNode): string {
  return shapeWithTextLabel(graph, node)?.text ?? ''
}
