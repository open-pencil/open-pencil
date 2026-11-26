import type { DesignNode } from '../types'

/**
 * Joins text that ends up side by side once what lies between it is dropped, such as a comment a
 * framework writes between two text nodes (`Category<!-- -->:`), into one run of text, as the
 * browser lays them out and as `Node.normalize` joins them.
 */
export function joinAdjacentText(nodes: readonly DesignNode[]): DesignNode[] {
  const joined: DesignNode[] = []
  for (const node of nodes) {
    const last = joined.at(-1)
    if (node.type === 'text' && last?.type === 'text') {
      joined[joined.length - 1] = { type: 'text', text: last.text + node.text }
    } else joined.push(node)
  }
  return joined
}
