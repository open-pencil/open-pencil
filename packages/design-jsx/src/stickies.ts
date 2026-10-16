import {
  createSticky,
  isWideSticky,
  STICKY_COLORS,
  stickyBodySizeFields,
  stickyScale,
  stickySublayers,
  stickyTextSize,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import { colorToHex, parseColor } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { STICKY_TEXT_SIZE } from './enums'
import type { TreeNode } from './tree'

/**
 * `<Sticky color="yellow" author="Ada">Body</Sticky>`: a FigJam sticky note, made from the same
 * template as the sticky tool's.
 */
export const STICKY_ELEMENT = 'sticky'

type StickyColorName = keyof typeof STICKY_COLORS

function isStickyColorName(value: string): value is StickyColorName {
  return value in STICKY_COLORS
}

/** A palette name such as `"yellow"`, or any colour. */
function colorOf(value: unknown): Color | undefined {
  if (typeof value !== 'string') return undefined
  return isStickyColorName(value) ? { ...STICKY_COLORS[value] } : parseColor(value)
}

function bodyOf(tree: TreeNode): string {
  return tree.children.filter((child): child is string => typeof child === 'string').join('')
}

/** The note an element describes, named by its body as FigJam names a note until renamed. */
export function renderStickyNode(graph: SceneGraph, tree: TreeNode, parentId: string) {
  const { props } = tree
  const text = bodyOf(tree)
  const author = typeof props.author === 'string' ? props.author : ''
  const parent = graph.getNode(parentId)
  const named = typeof props.name === 'string'
  const sticky = createSticky(
    graph,
    parentId,
    {
      text,
      author,
      authorVisible: props.authorVisible !== false && author !== '',
      color: colorOf(props.color),
      wide: props.wide === true,
      scale: typeof props.scale === 'number' && props.scale > 0 ? props.scale : 1
    },
    {
      name: named ? String(props.name) : text.trim() || 'Sticky',
      autoRename: !named,
      ...(typeof props.x === 'number' && { x: props.x }),
      ...(typeof props.y === 'number' && { y: props.y }),
      ...(props.visible === false && { visible: false }),
      ...(typeof props.opacity === 'number' && { opacity: props.opacity }),
      ...(props.position === 'absolute' &&
        parent?.layoutMode !== 'NONE' && { layoutPositioning: 'ABSOLUTE' as const })
    }
  )
  const body = stickySublayers(graph, sticky)?.body
  const textSize = STICKY_TEXT_SIZE.parse(props.textSize)
  if (body && textSize) graph.updateNode(body.id, stickyBodySizeFields(textSize))
  return sticky
}

/** The colour as `<Sticky>` writes it: its palette name, or a hex colour off the palette. */
function colorName(color: Color): string {
  const hex = colorToHex(color)
  const named = Object.entries(STICKY_COLORS).find(([, value]) => colorToHex(value) === hex)
  return named ? named[0] : hex
}

/** The name `<Sticky>` writes: none while the note is still named by its body. */
export function stickyName(graph: SceneGraph, node: SceneNode): string | null {
  const body = stickySublayers(graph, node)?.body.text ?? ''
  return node.autoRename || node.name === (body.trim() || 'Sticky') ? null : node.name
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
  if (layers && stickyTextSize(layers.body) !== 'small') {
    props.push(['textSize', stickyTextSize(layers.body)])
  }
  const scale = layers ? stickyScale(layers.author) : 1
  if (scale !== 1) props.push(['scale', scale])
  if (node.opacity < 1) props.push(['opacity', Math.round(node.opacity * 100) / 100])
  if (!node.visible) props.push(['visible', false])
  return props
}

/** The body a note writes as its children. */
export function stickyBody(graph: SceneGraph, node: SceneNode): string {
  return stickySublayers(graph, node)?.body.text ?? ''
}
