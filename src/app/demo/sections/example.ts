import { Frame, Text } from '@open-pencil/core/design-jsx'
import type { TreeNode } from '@open-pencil/core/design-jsx'

const INK = '#172554'
const MUTED = '#536487'
const TILE = '#EEF2FF'

/** The framed artwork panel shared by the demo's specimen sections. */
export function createArtworkTile(
  name: string,
  options: { padding?: number; center?: boolean; children?: TreeNode[] } = {}
): TreeNode {
  const props = {
    name,
    flex: 'row' as const,
    w: 'fill' as const,
    h: 'hug' as const,
    p: options.padding ?? 16,
    justify: 'center' as const,
    rounded: 12,
    bg: TILE,
    children: options.children ?? []
  }
  return Frame(options.center ? { ...props, items: 'center' as const } : props)
}

/** A labelled specimen column: artwork panel, title, and caption. */
export function createExampleColumn(options: {
  title: string
  caption: string
  artwork: TreeNode
}): TreeNode {
  return Frame({
    name: options.title,
    flex: 'col',
    w: 'fill',
    h: 'hug',
    gap: 8,
    children: [
      options.artwork,
      Text({ font: 'Inter', color: INK, size: 14, weight: 600, children: options.title }),
      Text({
        font: 'Inter',
        color: MUTED,
        size: 12,
        w: 'fill',
        lineHeight: 18,
        children: options.caption
      })
    ]
  })
}
