import { readIcon, readIconTint, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'

import type { JSXProp } from './props'

/** The frame name icons are placed with, which the export leaves to `<Icon>` to give again. */
const placedName = (name: string) => `Icon / ${name}`

/** The color an icon's tinted paths have, as `<Icon color>` takes it. */
function tintColor(graph: SceneGraph, frame: SceneNode): string | null {
  for (const path of graph.getChildren(frame.id)) {
    const tint = readIconTint(path)
    const paint = tint.includes('fill') ? path.fills[0] : undefined
    const stroke = tint.includes('stroke') ? path.strokes[0] : undefined
    const color = paint?.color ?? stroke?.color
    if (color) return colorToHex(color)
  }
  return null
}

/**
 * An icon frame as `<Icon>` props: its name and size, its color when it is not black, and its
 * layer name when someone renamed it. `null` for a layer that is not an icon.
 */
export function iconProps(node: SceneNode, graph: SceneGraph): JSXProp[] | null {
  const icon = readIcon(node)
  if (!icon) return null
  const color = tintColor(graph, node)
  return [
    ['name', icon.name],
    ['size', Math.round(Math.min(node.width, node.height))],
    ...(color && color.toLowerCase() !== '#000000' ? [['color', color] as JSXProp] : []),
    ...(node.name !== placedName(icon.name) ? [['label', node.name] as JSXProp] : [])
  ]
}
