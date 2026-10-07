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

/**
 * The name Figma gives a layer made on the canvas: its base name numbered one past the highest
 * number any layer on the page already has with it, so "Group 10" follows a "Group 9" anywhere on
 * the page, whatever that layer is. Scripts get the bare base name instead.
 */
export function nextNumberedName(graph: SceneGraph, pageId: string, base: string): string {
  const pattern = new RegExp(`^${escapeRegExp(base)} (\\d+)$`)
  let highest = 0
  const visit = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return
    const number = pattern.exec(node.name)?.[1]
    if (number) highest = Math.max(highest, Number(number))
    for (const childId of node.childIds) visit(childId)
  }
  for (const childId of graph.getNode(pageId)?.childIds ?? []) visit(childId)
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
