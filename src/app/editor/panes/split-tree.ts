import type { CanvasSplitNode, SplitDirection } from './types'

export const MAX_VISIBLE_CANVAS_PANES = 4

export function childKey(node: CanvasSplitNode): string {
  return node.type === 'pane' ? node.paneId : node.id
}

export function paneCount(node: CanvasSplitNode): number {
  if (node.type === 'pane') return 1
  return node.children.reduce((count, child) => count + paneCount(child), 0)
}

export function leafPaneIds(node: CanvasSplitNode): string[] {
  if (node.type === 'pane') return [node.paneId]
  return node.children.flatMap(leafPaneIds)
}

export function normalizeSizes(length: number, sizes?: number[]): number[] {
  if (length <= 0) return []
  if (
    !sizes ||
    sizes.length !== length ||
    !sizes.every((size) => Number.isFinite(size) && size > 0)
  ) {
    return Array.from({ length }, () => 100 / length)
  }
  const total = sizes.reduce((sum, size) => sum + size, 0)
  if (!Number.isFinite(total) || total <= 0) return Array.from({ length }, () => 100 / length)
  return sizes.map((size) => (size / total) * 100)
}

export function isValidLayoutSizes(sizes: number[], childLength: number): boolean {
  return (
    sizes.length === childLength &&
    sizes.length > 0 &&
    sizes.every((size) => Number.isFinite(size) && size > 0)
  )
}

export function updateSplitSizes(
  node: CanvasSplitNode,
  splitId: string,
  sizes: number[]
): CanvasSplitNode {
  if (node.type === 'pane') return node
  if (node.id === splitId) {
    if (!isValidLayoutSizes(sizes, node.children.length)) return node
    return { ...node, sizes: normalizeSizes(node.children.length, sizes) }
  }
  return {
    ...node,
    children: node.children.map((child) => updateSplitSizes(child, splitId, sizes))
  }
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
    sizes: normalizeSizes(node.children.length, node.sizes)
  }
}

export function closePaneNode(node: CanvasSplitNode, paneId: string): CanvasSplitNode | null {
  if (node.type === 'pane') return node.paneId === paneId ? null : node

  const children = node.children
    .map((child) => closePaneNode(child, paneId))
    .filter((child): child is CanvasSplitNode => child !== null)

  if (children.length === 0) return null
  if (children.length === 1) return children[0]
  return { ...node, children, sizes: normalizeSizes(children.length) }
}

export function containsPane(node: CanvasSplitNode, paneId: string): boolean {
  if (node.type === 'pane') return node.paneId === paneId
  return node.children.some((child) => containsPane(child, paneId))
}
