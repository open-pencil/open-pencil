import type { DesignElement, DesignNode } from '@open-pencil/dom-css'

/** The elements among `nodes` and everything they hold, in document order. */
export function designElements(nodes: readonly DesignNode[]): DesignElement[] {
  const elements: DesignElement[] = []
  const walk = (children: readonly DesignNode[]) => {
    for (const node of children) {
      if (node.type !== 'element') continue
      elements.push(node)
      walk(node.children)
    }
  }
  walk(nodes)
  return elements
}
