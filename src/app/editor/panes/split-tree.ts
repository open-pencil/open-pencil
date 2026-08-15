export const MAX_VISIBLE_CANVAS_PANES = 4

export type SplitDirection = 'horizontal' | 'vertical'

export type CanvasSplitNode =
  | { type: 'pane'; paneId: string }
  | {
      type: 'split'
      id: string
      direction: SplitDirection
      children: CanvasSplitNode[]
      sizes: number[]
    }

export function paneCount(node: CanvasSplitNode): number {
  return node.type === 'pane'
    ? 1
    : node.children.reduce((count, child) => count + paneCount(child), 0)
}

export function leafPaneIds(node: CanvasSplitNode): string[] {
  return node.type === 'pane' ? [node.paneId] : node.children.flatMap(leafPaneIds)
}

export function containsPane(node: CanvasSplitNode, paneId: string): boolean {
  return node.type === 'pane'
    ? node.paneId === paneId
    : node.children.some((child) => containsPane(child, paneId))
}

export function normalizeSplitSizes(length: number, sizes?: number[]): number[] {
  if (length <= 0) return []
  if (
    !sizes ||
    sizes.length !== length ||
    !sizes.every((size) => Number.isFinite(size) && size > 0)
  ) {
    return Array.from({ length }, () => 100 / length)
  }
  const total = sizes.reduce((sum, size) => sum + size, 0)
  return sizes.map((size) => (size / total) * 100)
}

export function splitPaneNode(
  node: CanvasSplitNode,
  paneId: string,
  newPaneId: string,
  splitId: string,
  direction: SplitDirection
): CanvasSplitNode {
  if (node.type === 'pane') {
    return node.paneId === paneId
      ? {
          type: 'split',
          id: splitId,
          direction,
          children: [node, { type: 'pane', paneId: newPaneId }],
          sizes: [50, 50]
        }
      : node
  }
  return {
    ...node,
    children: node.children.map((child) =>
      splitPaneNode(child, paneId, newPaneId, splitId, direction)
    ),
    sizes: normalizeSplitSizes(node.children.length, node.sizes)
  }
}

export function closePaneNode(node: CanvasSplitNode, paneId: string): CanvasSplitNode | null {
  if (node.type === 'pane') return node.paneId === paneId ? null : node
  const children = node.children
    .map((child) => closePaneNode(child, paneId))
    .filter((child): child is CanvasSplitNode => child !== null)
  if (children.length === 0) return null
  if (children.length === 1) return children[0]
  return { ...node, children, sizes: normalizeSplitSizes(children.length) }
}

export function updateSplitSizes(
  node: CanvasSplitNode,
  splitId: string,
  sizes: number[]
): CanvasSplitNode {
  if (node.type === 'pane') return node
  if (node.id === splitId) {
    if (sizes.length !== node.children.length) return node
    if (!sizes.every((size) => Number.isFinite(size) && size > 0)) return node
    return { ...node, sizes: normalizeSplitSizes(node.children.length, sizes) }
  }
  return {
    ...node,
    children: node.children.map((child) => updateSplitSizes(child, splitId, sizes))
  }
}
