import * as v from 'valibot'

import { parseJSXAttributes, sceneNodeAttributes, sceneNodeToJSX } from '@open-pencil/design-jsx'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { toolNumber, nodeIdInput, nodeComparisonInput } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

import { applyOperations, planOperations, type ApplyStatus } from './apply'
import { formatOperations, parseOperations } from './format'
import { deltaOperations, type DiffOperation } from './operations'
import { DEFAULT_DIFF_DEPTH, diffProjections, projectTree, type ProjectOptions } from './projection'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Operations that turn the `from` tree into the `to` tree, matching children by name path. */
function treeOperations(
  graph: SceneGraph,
  from: string,
  to: string,
  options: ProjectOptions
): DiffOperation[] {
  const before = projectTree(graph, from, options)
  const after = projectTree(graph, to, options)
  if (!before || !after) return []
  // Compare the trees, not their roots' names: a copy is usually renamed.
  const { name: _name, ...attributes } = after.attributes
  const name = before.attributes.name as string | undefined
  const target = {
    ...after,
    name: before.name,
    attributes: name ? { ...attributes, name } : attributes
  }
  return deltaOperations(diffProjections(before, target), before, target, (id) =>
    sceneNodeToJSX(id, graph)
  )
}

export const diffCreate = defineTool({
  name: 'diff_create',
  description:
    'Patch that turns one node tree into another, as JSX attribute changes per node plus moved, added, and removed children. Children are matched by name. Apply it to the first tree with diff_apply.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    ...nodeComparisonInput.entries,
    depth: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.integer(),
          v.minValue(0),
          v.description(`Max tree depth (default: ${DEFAULT_DIFF_DEPTH})`)
        )
      )
    )
  }),
  execute: (figma, args) => {
    if (!figma.graph.getNode(args.from)) return { error: `Node "${args.from}" not found` }
    if (!figma.graph.getNode(args.to)) return { error: `Node "${args.to}" not found` }
    const operations = treeOperations(figma.graph, args.from, args.to, {
      match: 'path',
      depth: args.depth ?? DEFAULT_DIFF_DEPTH
    })
    return operations.length === 0
      ? { diff: null, message: 'No differences found' }
      : { diff: formatOperations(operations) }
  }
})

export const diffShow = defineTool({
  name: 'diff_show',
  description:
    'Preview setting JSX attributes on a node, without changing it. Returns the patch, which diff_apply applies.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    id: nodeIdInput,
    attributes: v.pipe(
      v.string(),
      v.description(
        'JSX attributes to set, named as the JSX export writes them. Example: w={200} bg="#FF0000" opacity={0.5}'
      )
    )
  }),
  execute: (figma, args) => {
    const node = figma.graph.getNode(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    const current = sceneNodeAttributes(node.id, figma.graph)
    if (!current) return { error: `${node.type} nodes have no JSX attributes` }
    let proposed
    try {
      proposed = parseJSXAttributes(args.attributes)
    } catch (error) {
      return { error: errorMessage(error) }
    }
    const sources = new Map(current.map(({ name, source }) => [name, source]))
    const changed = proposed.filter(({ name, source }) => sources.get(name) !== source)
    if (changed.length === 0) return { diff: null, message: 'No changes' }
    const operation: DiffOperation = {
      kind: 'update',
      path: `/${node.name}`,
      id: node.id,
      removed: changed.flatMap(({ name }) => sources.get(name) ?? []),
      added: changed.map(({ source }) => source)
    }
    // Check the change the way diff_apply would, so invalid values surface here.
    const [plan] = planOperations(figma.graph, [operation], false)
    if (plan.result.error) return { error: plan.result.error }
    return { diff: formatOperations([operation]) }
  }
})

export const diffApply = defineTool({
  name: 'diff_apply',
  description:
    "Apply a patch from diff_create, diff_show, or diff_changes. Each node must still have the patch's old values unless force is set, and nothing changes unless every hunk applies. Use dryRun to check first.",
  execution: { kind: 'async', mutation: 'document' },
  input: v.strictObject({
    patch: v.pipe(
      v.string(),
      v.description('Patch text from diff_create, diff_show, or diff_changes')
    ),
    dryRun: v.optional(
      v.pipe(v.boolean(), v.description('Check and report changes without applying')),
      false
    ),
    force: v.optional(
      v.pipe(v.boolean(), v.description('Apply even when current values differ from the patch')),
      false
    )
  }),
  execute: async (figma, args) => {
    let operations: DiffOperation[]
    try {
      operations = parseOperations(args.patch)
    } catch (error) {
      return { error: errorMessage(error) }
    }
    if (operations.length === 0) return { error: 'No hunks found' }
    const results = await applyOperations(figma, operations, {
      dryRun: args.dryRun,
      force: args.force
    })
    const count = (...statuses: ApplyStatus[]) =>
      results.filter((result) => statuses.includes(result.status)).length
    const failed = count('failed')
    if (failed > 0 && !args.dryRun) {
      return { error: 'Patch does not apply', results: results.filter((r) => r.error) }
    }
    return {
      dryRun: args.dryRun,
      applied: count('applied', 'removed', 'moved', 'added'),
      failed,
      results
    }
  }
})
