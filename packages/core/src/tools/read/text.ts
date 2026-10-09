import * as v from 'valibot'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { toolNumber } from '#core/tools/input'
import { defineTool, nodeNotFound } from '#core/tools/schema'

const MAX_TEXT_EXPORT_NODES = 10_000
const MAX_TEXT_EXPORT_CHARS = 32_000
const MAX_TEXT_EXPORT_ROOTS = 1_000
const TEXT_NODE_SEPARATOR = '\n\n'

interface TextExportResult {
  text: string
  textNodeCount: number
  truncated: boolean
}

/** Drop overlapping roots and check visibility all the way to the document root. */
function exportRoots(graph: SceneGraph, ids: string[], includeHidden: boolean) {
  const requested = new Set(ids)
  const roots: string[] = []
  let steps = 0
  for (const id of requested) {
    let node = graph.getNode(id)
    const ancestors = new Set<string>()
    let excluded = false
    while (node) {
      if (++steps > MAX_TEXT_EXPORT_NODES || ancestors.has(node.id)) {
        return { roots: [], truncated: true }
      }
      ancestors.add(node.id)
      if ((!includeHidden && !node.visible) || (node.id !== id && requested.has(node.id))) {
        excluded = true
        break
      }
      node = node.parentId ? graph.getNode(node.parentId) : undefined
    }
    if (!excluded) roots.push(id)
  }
  return { roots, truncated: false }
}

/** Do not split a UTF-16 surrogate pair at the response boundary. */
function textPrefix(text: string, length: number): string {
  const end = text.charCodeAt(length - 1)
  const next = text.charCodeAt(length)
  const splitsPair = end >= 0xd800 && end <= 0xdbff && next >= 0xdc00 && next <= 0xdfff
  return text.slice(0, splitsPair ? length - 1 : length)
}

/** Append one text node within the response budget, keeping a partial final node if it fits. */
function appendText(result: TextExportResult, content: string, maxChars: number): void {
  const separator = result.textNodeCount > 0 ? TEXT_NODE_SEPARATOR : ''
  const available = maxChars - result.text.length - separator.length
  if (available < 0 || (available === 0 && content.length > 0)) {
    result.truncated = true
    return
  }
  const text = textPrefix(content, available)
  result.text += separator + text
  result.textNodeCount++
  result.truncated = text.length < content.length
}

export const exportText = defineTool({
  name: 'export_text',
  description:
    'Extract plain text from nodes and their descendants without rendering or changing selection. Overlapping roots are deduplicated. Roots follow the requested order; descendants follow layer-tree order, not visual reading order. Text nodes are separated by two newlines; internal whitespace is preserved. Hidden layers and descendants of hidden ancestors are excluded unless includeHidden is true. Returns text, textNodeCount (nodes included, including a partial final node), and truncated.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    ids: v.optional(
      v.pipe(
        v.array(v.string()),
        v.minLength(1),
        v.maxLength(MAX_TEXT_EXPORT_ROOTS),
        v.description('Node IDs to export. Omit to export all top-level nodes on the current page.')
      )
    ),
    includeHidden: v.optional(v.boolean(), false),
    maxChars: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.integer(),
          v.minValue(1),
          v.maxValue(MAX_TEXT_EXPORT_CHARS),
          v.description(
            'Maximum returned UTF-16 code units, including separators (default: 32000).'
          )
        )
      ),
      MAX_TEXT_EXPORT_CHARS
    ),
    maxNodes: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.integer(),
          v.minValue(1),
          v.maxValue(MAX_TEXT_EXPORT_NODES),
          v.description(
            'Maximum visited layers, including non-text layers (default: 10000). Ancestor checks are separately bounded to 10000 steps.'
          )
        )
      ),
      MAX_TEXT_EXPORT_NODES
    )
  }),
  execute: (figma, { ids, includeHidden, maxChars, maxNodes }) => {
    const graph = figma.graph
    const requested = ids ?? [figma.currentPageId]
    for (const id of requested) {
      if (!graph.getNode(id)) return nodeNotFound(id)
    }
    const prepared = exportRoots(graph, requested, includeHidden)
    const result = { text: '', textNodeCount: 0, truncated: prepared.truncated }
    const stack: Array<Iterator<string>> = [prepared.roots.values()]
    const visited = new Set<string>()
    while (stack.length > 0) {
      const next = stack.at(-1)?.next()
      if (!next || next.done) {
        stack.pop()
        continue
      }
      const id = next.value
      if (visited.has(id)) continue
      if (visited.size >= maxNodes) {
        result.truncated = true
        break
      }
      visited.add(id)
      const node = graph.getNode(id)
      if (!node || (!includeHidden && !node.visible)) continue
      if (node.type === 'TEXT') {
        appendText(result, node.text, maxChars)
        if (result.truncated) break
      }
      if (node.childIds.length > 0) stack.push(node.childIds.values())
    }
    return result
  }
})
