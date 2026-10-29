import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'
import {
  createSticky,
  isWideSticky,
  STICKY_COLORS,
  stickyScale,
  stickySublayers
} from '@open-pencil/scene-graph/generated'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { figJamTextFields, figJamTextProps } from './figjam-text'
import { readElementProps, stickyPropsSchema } from './schema'
import { plainTextOf, type TreeNode } from './tree'

/**
 * `<Sticky color="yellow" author="Ada">Body</Sticky>`: a FigJam sticky note, made from the same
 * template as the sticky tool's.
 */
export const STICKY_ELEMENT = 'sticky'

/**
 * The note an element describes, with `layer`'s fields; it is named by its body, as FigJam names
 * a note, until given a name.
 */
export function renderStickyNode(
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string,
  layer: Partial<SceneNode>
) {
  const props = readElementProps(stickyPropsSchema, tree.props)
  const text = plainTextOf(tree)
  const author = props.author ?? ''
  const sticky = createSticky(
    graph,
    parentId,
    {
      text,
      author,
      authorVisible: props.authorVisible !== false && author !== '',
      color: props.color,
      wide: props.wide === true,
      scale: props.scale ?? 1
    },
    { ...layer, name: layer.name ?? (text.trim() || 'Sticky'), autoRename: !layer.name }
  )
  const body = stickySublayers(graph, sticky)?.body
  if (body) graph.updateNode(body.id, figJamTextFields(body, props.textSize, props.typeface))
  return sticky
}

/** The colour as `<Sticky>` writes it: its palette name, or a hex colour off the palette. */
function colorName(color: Color): string {
  const hex = colorToHex(color)
  const named = Object.entries(STICKY_COLORS).find(([, value]) => colorToHex(value) === hex)
  return named ? named[0] : hex
}

/** A note's own props as `<Sticky>` writes them, after its name and position. */
export function stickyProps(graph: SceneGraph, node: SceneNode): Array<[string, unknown]> {
  const layers = stickySublayers(graph, node)
  const color = node.fills.at(0)?.color
  const props: Array<[string, unknown]> = []
  if (color) props.push(['color', colorName(color)])
  if (layers?.author.text) props.push(['author', layers.author.text])
  if (layers?.author.text && !layers.author.visible) props.push(['authorVisible', false])
  if (isWideSticky(graph, node)) props.push(['wide', true])
  if (layers) props.push(...figJamTextProps(layers.body))
  const scale = layers ? stickyScale(layers.author) : 1
  if (scale !== 1) props.push(['scale', scale])
  return props
}

/** The body a note writes as its children. */
export function stickyBody(graph: SceneGraph, node: SceneNode): string {
  return stickySublayers(graph, node)?.body.text ?? ''
}
