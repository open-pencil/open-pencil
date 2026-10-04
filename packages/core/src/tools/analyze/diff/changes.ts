import * as v from 'valibot'

import { sceneNodeToJSX } from '@open-pencil/design-jsx'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { findPageId } from '#core/io/subgraph'
import { defineTool } from '#core/tools/schema'

import { formatOperations } from './format'
import { deltaOperations, type DiffOperation } from './operations'
import { diffProjections, projectTree } from './projection'

/** Edits between two states of one tree, matching nodes by ID. */
function treeChanges(baseline: SceneGraph, graph: SceneGraph, rootId: string): DiffOperation[] {
  const before = projectTree(baseline, rootId, { match: 'id' })
  const after = projectTree(graph, rootId, { match: 'id' })
  if (!before || !after) return []
  return deltaOperations(diffProjections(before, after), before, after, (id) =>
    sceneNodeToJSX(id, graph)
  )
}

/**
 * Edits to one node. A node the run added or removed exists on one side only, so its
 * parent is compared instead, keeping the edits that add or remove it.
 */
function nodeChanges(
  baseline: SceneGraph,
  graph: SceneGraph,
  id: string,
  pageId: string
): DiffOperation[] {
  if (baseline.getNode(id) && graph.getNode(id)) return treeChanges(baseline, graph, id)
  const parentId = (graph.getNode(id) ?? baseline.getNode(id))?.parentId
  const rootId =
    parentId && baseline.getNode(parentId) && graph.getNode(parentId) ? parentId : pageId
  const added = graph.getNode(id) ? sceneNodeToJSX(id, graph) : null
  return treeChanges(baseline, graph, rootId).filter((operation) =>
    operation.kind === 'add' ? added !== null && operation.jsx.includes(added) : operation.id === id
  )
}

export const diffChanges = defineTool({
  name: 'diff_changes',
  description:
    'Patch of what this run changed: a node, or the whole current page, compared with its page before the run first edited it. Same format as diff_create, matching nodes by ID, so diff_apply can replay it on the starting state. Use it before reporting to confirm that only the intended layers changed.',
  execution: { kind: 'sync', mutation: 'none' },
  // Only an AI chat run records the state it started from.
  exposure: { mcp: false, webmcp: false },
  input: v.object({
    id: v.optional(v.pipe(v.string(), v.description('Node to compare (default: the current page)')))
  }),
  execute: (figma, args) => {
    if (!figma.changeBaseline) return { error: 'diff_changes is available only in an AI chat run' }
    const targetId = args.id ?? figma.currentPage.id
    // A node is compared with its own page's baseline; a removed one is looked up on this page.
    const pageId = args.id
      ? (findPageId(figma.graph, args.id) ?? figma.currentPage.id)
      : figma.currentPage.id
    const baseline = figma.changeBaseline(pageId)
    if (!baseline) return { diff: null, message: 'This run has not changed that page' }
    if (!baseline.getNode(targetId) && !figma.graph.getNode(targetId)) {
      return { error: `Node "${targetId}" not found` }
    }
    const operations =
      targetId === pageId
        ? treeChanges(baseline, figma.graph, pageId)
        : nodeChanges(baseline, figma.graph, targetId, pageId)
    return operations.length === 0
      ? { diff: null, message: 'No differences found' }
      : { diff: formatOperations(operations) }
  }
})
