import { difference, groupBy, isEqual, pickBy, uniq } from 'es-toolkit'

import {
  buildComponent,
  createElement,
  DESIGN_JSX_SUPPORTED_PROPERTIES,
  jsxNodeFields,
  parseJSXAttributes,
  resolveToTree,
  sceneNodeAttributes,
  type JSXAttributeSource
} from '@open-pencil/design-jsx'
import { recordInstanceOverride, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import type { FigmaAPI } from '#core/figma-api'

import type { DiffOperation } from './operations'

export type ApplyStatus = 'applied' | 'removed' | 'moved' | 'added' | 'unchanged' | 'failed'

export interface ApplyResult {
  path: string
  id: string | null
  status: ApplyStatus
  /** Attributes an update sets or clears. */
  changes?: string[]
  error?: string
}

export interface ApplyOptions {
  dryRun: boolean
  /** Skip comparing the patch's old values with the document. */
  force: boolean
}

interface NodeUpdate {
  id: string
  fields: Partial<SceneNode>
  bind: Record<string, string>
  unbind: string[]
}

/** Where a moved node (`ids`) or an added one (`jsx`, rendered into `ids`) ends up. */
interface Placement {
  parentId: string
  index: number
  ids?: string[]
  jsx?: string
}

/** A checked operation, with what committing it needs. */
interface Plan {
  result: ApplyResult
  update?: NodeUpdate
  place?: Placement
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function failed(operation: DiffOperation, error: string): Plan {
  const id = operation.kind === 'add' ? operation.parentId : operation.id
  return { result: { path: operation.path, id, status: 'failed', error } }
}

function editableNode(graph: SceneGraph, id: string): SceneNode | string {
  const node = graph.getNode(id)
  if (!node) return `Node "${id}" not found`
  try {
    assertNodeEditable(graph, id)
  } catch (error) {
    return errorMessage(error)
  }
  return node
}

/** Attributes as written; one the renderer would ignore fails, rather than applying as nothing. */
function parseSources(sources: string[]): JSXAttributeSource[] {
  const attributes = sources.flatMap((source) => parseJSXAttributes(source))
  const unsupported = attributes.find(({ name }) => !DESIGN_JSX_SUPPORTED_PROPERTIES.has(name))
  if (unsupported) throw new Error(`Unsupported attribute "${unsupported.name}"`)
  return attributes
}

/** Old values that differ from the node's, and new attributes it already has. */
function staleValues(
  current: Map<string, string>,
  removed: JSXAttributeSource[],
  added: JSXAttributeSource[]
): string[] {
  const removedNames = new Set(removed.map((attribute) => attribute.name))
  const describe = (name: string) => current.get(name) ?? '(none)'
  return [
    ...removed
      .filter((attribute) => current.get(attribute.name) !== attribute.source)
      .map(({ name, source }) => `${name}: expected ${source}, found ${describe(name)}`),
    ...added
      .filter((attribute) => !removedNames.has(attribute.name) && current.has(attribute.name))
      .map(({ name }) => `${name}: expected none, found ${describe(name)}`)
  ]
}

/** The fields and bindings that change between two attribute sets of one node. */
function nodeUpdate(
  graph: SceneGraph,
  node: SceneNode,
  before: JSXAttributeSource[],
  after: JSXAttributeSource[]
): NodeUpdate {
  const parentId = node.parentId ?? ''
  const from = jsxNodeFields(graph, node.type, before, parentId)
  const to = jsxNodeFields(graph, node.type, after, parentId)
  return {
    id: node.id,
    fields: pickBy(to.fields, (value, key) => !isEqual(from.fields[key], value)),
    bind: Object.fromEntries(
      Object.entries(to.bindings).filter(([field, id]) => from.bindings[field] !== id)
    ),
    unbind: difference(Object.keys(from.bindings), Object.keys(to.bindings))
  }
}

function planUpdate(
  graph: SceneGraph,
  operation: Extract<DiffOperation, { kind: 'update' }>,
  force: boolean
): Plan {
  const node = editableNode(graph, operation.id)
  if (typeof node === 'string') return failed(operation, node)
  const attributes = sceneNodeAttributes(node.id, graph)
  if (!attributes) return failed(operation, `${node.type} nodes have no JSX attributes`)
  try {
    const removed = parseSources(operation.removed)
    const added = parseSources(operation.added)
    const current = new Map(attributes.map(({ name, source }) => [name, source]))
    const stale = force ? [] : staleValues(current, removed, added)
    if (stale.length > 0) {
      return failed(operation, `Current state does not match: ${stale.join('; ')}`)
    }
    const target = new Map(current)
    for (const { name } of removed) target.delete(name)
    for (const { name, source } of added) target.set(name, source)
    const toSources = (map: Map<string, string>) =>
      [...map].map(([name, source]) => ({ name, source }))
    const update = nodeUpdate(graph, node, attributes, toSources(target))
    const changes = uniq([...removed, ...added].map((attribute) => attribute.name))
    const empty =
      Object.keys(update.fields).length === 0 &&
      Object.keys(update.bind).length === 0 &&
      update.unbind.length === 0
    const status = empty ? 'unchanged' : 'applied'
    return { result: { path: operation.path, id: node.id, status, changes }, update }
  } catch (error) {
    return failed(operation, errorMessage(error))
  }
}

function planAdd(graph: SceneGraph, operation: Extract<DiffOperation, { kind: 'add' }>): Plan {
  const parent = editableNode(graph, operation.parentId)
  if (typeof parent === 'string') return failed(operation, parent)
  if (!operation.jsx.trim()) return failed(operation, 'Added node has no JSX')
  try {
    // Evaluate now so invalid JSX fails before anything changes.
    if (!resolveToTree(createElement(buildComponent(operation.jsx), null))) {
      return failed(operation, 'Added JSX renders nothing')
    }
  } catch (error) {
    return failed(operation, errorMessage(error))
  }
  const place = { parentId: parent.id, index: operation.index, jsx: operation.jsx }
  return { result: { path: operation.path, id: null, status: 'added' }, place }
}

function planOperation(graph: SceneGraph, operation: DiffOperation, force: boolean): Plan {
  switch (operation.kind) {
    case 'update':
      return planUpdate(graph, operation, force)
    case 'remove': {
      const node = editableNode(graph, operation.id)
      if (typeof node === 'string') return failed(operation, node)
      return { result: { path: operation.path, id: node.id, status: 'removed' } }
    }
    case 'move': {
      const node = editableNode(graph, operation.id)
      if (typeof node === 'string') return failed(operation, node)
      if (!node.parentId) return failed(operation, `Node "${node.id}" has no parent`)
      const place = { parentId: node.parentId, index: operation.index, ids: [node.id] }
      return { result: { path: operation.path, id: node.id, status: 'moved' }, place }
    }
  }
  return planAdd(graph, operation)
}

/** Check every operation against the document without changing it. */
export function planOperations(
  graph: SceneGraph,
  operations: DiffOperation[],
  force: boolean
): Plan[] {
  return operations.map((operation) => planOperation(graph, operation, force))
}

function commitUpdate(graph: SceneGraph, update: NodeUpdate): void {
  graph.updateNode(update.id, update.fields)
  recordInstanceOverride(graph, update.id, Object.keys(update.fields))
  for (const field of update.unbind) graph.unbindVariable(update.id, field)
  for (const [field, variableId] of Object.entries(update.bind)) {
    graph.bindVariable(update.id, field, variableId)
  }
}

type Placed = Plan & { place: Placement }

/**
 * Render added nodes before changing anything else. Rendering can still fail, for example on
 * an icon that cannot be fetched; then the nodes rendered so far are deleted and nothing else
 * is committed, so a patch never half-applies.
 */
async function renderAdditions(figma: FigmaAPI, plans: Placed[]): Promise<boolean> {
  const { renderJSX } = await import('#core/design-jsx')
  const rendered: string[] = []
  for (const plan of plans) {
    const { jsx, parentId } = plan.place
    if (jsx === undefined) continue
    try {
      const results = await renderJSX(figma.graph, jsx, { parentId })
      plan.place.ids = results.map((result) => result.id)
      plan.result.id = results[0].id
      rendered.push(...plan.place.ids)
    } catch (error) {
      plan.result.status = 'failed'
      plan.result.error = errorMessage(error)
      for (const id of rendered.toReversed()) figma.graph.deleteNode(id)
      for (const other of plans) if (other.place.jsx !== undefined) other.result.id = null
      return false
    }
  }
  return true
}

/**
 * Moves and additions under one parent, as jsondiffpatch patches arrays: take the placed
 * children out, then insert each at its final index, in index order.
 */
function commitPlacements(graph: SceneGraph, parentId: string, plans: Placed[]): void {
  const placed = new Set(plans.flatMap((plan) => plan.place.ids ?? []))
  const order = (graph.getNode(parentId)?.childIds ?? []).filter((id) => !placed.has(id))
  for (const plan of plans.toSorted((a, b) => a.place.index - b.place.index)) {
    order.splice(plan.place.index, 0, ...(plan.place.ids ?? []))
  }
  for (const [index, id] of order.entries()) {
    if (graph.getNode(parentId)?.childIds[index] !== id) graph.insertChildAt(id, parentId, index)
  }
}

/**
 * Apply a patch's operations. Every operation is checked first and nothing changes unless all
 * pass; a dry run stops there. Added nodes render first, so one that fails to render leaves the
 * document as it was. Updates go through the JSX renderer's prop handling and change only the
 * fields their attributes move, so IDs, instance links, and other state survive.
 */
export async function applyOperations(
  figma: FigmaAPI,
  operations: DiffOperation[],
  options: ApplyOptions
): Promise<ApplyResult[]> {
  const plans = planOperations(figma.graph, operations, options.force)
  const results = () => plans.map((plan) => plan.result)
  if (options.dryRun || plans.some((plan) => plan.result.status === 'failed')) return results()
  const placed = plans.filter((plan): plan is Placed => !!plan.place)
  if (!(await renderAdditions(figma, placed))) return results()
  for (const plan of plans) {
    if (plan.update && plan.result.status === 'applied') {
      commitUpdate(figma.graph, plan.update)
    }
  }
  for (const plan of plans) {
    if (plan.result.status === 'removed' && plan.result.id) {
      // A removed ancestor already took its descendants with it.
      figma.getNodeById(plan.result.id)?.remove()
    }
  }
  for (const [parentId, group] of Object.entries(groupBy(placed, (plan) => plan.place.parentId))) {
    commitPlacements(figma.graph, parentId, group)
  }
  return results()
}
