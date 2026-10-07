import { escapeRegExp } from 'es-toolkit/string'

import type { NodeType, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export interface RenameSelectionOptions {
  match: string
  replacement: string
  startNumber: number
}

export interface RenameSelectionPreview {
  names: ReadonlyMap<string, string>
  error: 'invalid-pattern' | null
}

export function defaultNodeName(type: NodeType): string {
  const words = type.toLowerCase().replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The page a node is on, or the node itself when it is a page. */
function pageContaining(graph: SceneGraph, nodeId: string): SceneNode | undefined {
  let node = graph.getNode(nodeId)
  while (node && node.type !== 'CANVAS')
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  return node
}

/**
 * The name Figma gives a layer made on the canvas: its base name numbered one past the highest
 * number any layer on its page already has with it, so "Group 10" follows a "Group 9" anywhere on
 * that page, whatever that layer is. `parentId` is where the new layer goes, which decides the
 * page. Scripts get the bare base name instead.
 */
export function nextNumberedName(graph: SceneGraph, parentId: string, base: string): string {
  const pattern = new RegExp(`^${escapeRegExp(base)} (\\d+)$`)
  let highest = 0
  const visit = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return
    const number = pattern.exec(node.name)?.[1]
    if (number) highest = Math.max(highest, Number(number))
    for (const childId of node.childIds) visit(childId)
  }
  for (const childId of pageContaining(graph, parentId)?.childIds ?? []) visit(childId)
  return `${base} ${highest + 1}`
}

function numberedReplacement(
  replacement: string,
  index: number,
  count: number,
  startNumber: number
): string {
  const firstNumber = Number.isFinite(startNumber) ? Math.trunc(startNumber) : 1
  return replacement.replace(/\$([nN]+)/g, (_token, digits: string) => {
    const ascending = digits[0] === 'n'
    const number = ascending ? firstNumber + index : firstNumber + count - index - 1
    return String(number).padStart(digits.length, '0')
  })
}

export function previewRenamedNodes(
  nodes: readonly SceneNode[],
  options: RenameSelectionOptions
): RenameSelectionPreview {
  let pattern: RegExp
  try {
    pattern = options.match ? new RegExp(options.match) : /^.*$/
  } catch {
    return { names: new Map(), error: 'invalid-pattern' }
  }

  const names = new Map<string, string>()
  nodes.forEach((node, index) => {
    const replacement = numberedReplacement(
      options.replacement,
      index,
      nodes.length,
      options.startNumber
    )
    const renamed = node.name.replace(pattern, replacement).trim()
    names.set(node.id, renamed || defaultNodeName(node.type))
  })
  return { names, error: null }
}
