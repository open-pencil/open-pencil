import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export interface FigPopulationDelta {
  created: Array<[string, SceneNode]>
  updated: Array<[string, Partial<SceneNode>]>
  deleted: string[]
  populatedRootIds: string[]
}

export interface FigMutationJournal {
  before: Map<string, Partial<SceneNode>>
  created: Set<string>
  deleted: Set<string>
  stop: () => void
}

export function installFigMutationJournal(graph: SceneGraph): FigMutationJournal {
  const existingAtStart = new Set(graph.nodes.keys())
  const before = new Map<string, Partial<SceneNode>>()
  const created = new Set<string>()
  const deleted = new Set<string>()
  const original = {
    createNode: graph.createNode.bind(graph),
    createNodeWithId: graph.createNodeWithId.bind(graph),
    updateNode: graph.updateNode.bind(graph),
    deleteNode: graph.deleteNode.bind(graph)
  }
  function touch(id: string | null | undefined, fields: Iterable<keyof SceneNode>): void {
    if (!id || created.has(id)) return
    const node = graph.getNode(id)
    if (!node) return
    const snapshot = before.get(id) ?? {}
    before.set(id, snapshot)
    for (const field of fields) {
      if (!(field in snapshot)) Object.assign(snapshot, { [field]: structuredClone(node[field]) })
    }
  }
  graph.createNode = (type, parentId, overrides) => {
    touch(parentId, ['childIds'])
    const node = original.createNode(type, parentId, overrides)
    created.add(node.id)
    return node
  }
  graph.createNodeWithId = (id, type, parentId, overrides) => {
    touch(parentId, ['childIds'])
    const node = original.createNodeWithId(id, type, parentId, overrides)
    created.add(node.id)
    return node
  }
  graph.updateNode = (id, changes) => {
    const node = graph.getNode(id)
    if (node) {
      const fields = (Object.keys(changes) as (keyof SceneNode)[]).filter(
        (field) => !isEqual(node[field], changes[field])
      )
      if (fields.length > 0) fields.push('source')
      if ('componentId' in changes) fields.push('componentId')
      if ('fills' in changes || 'strokes' in changes) fields.push('boundVariables')
      touch(id, fields)
    }
    original.updateNode(id, changes)
  }
  graph.deleteNode = (id) => {
    const node = graph.getNode(id)
    touch(node?.parentId, ['childIds'])
    const pending = node ? [id] : []
    while (pending.length > 0) {
      const currentId = pending.pop()
      if (!currentId) continue
      const current = graph.getNode(currentId)
      if (current) for (const childId of current.childIds) pending.push(childId)
      if (!existingAtStart.has(currentId)) {
        created.delete(currentId)
        before.delete(currentId)
      } else deleted.add(currentId)
    }
    original.deleteNode(id)
  }
  return {
    before,
    created,
    deleted,
    stop() {
      graph.createNode = original.createNode
      graph.createNodeWithId = original.createNodeWithId
      graph.updateNode = original.updateNode
      graph.deleteNode = original.deleteNode
    }
  }
}

export function buildFigPopulationDelta(
  graph: SceneGraph,
  journal: FigMutationJournal,
  populatedRootIds: Iterable<string>
): FigPopulationDelta {
  const updated: Array<[string, Partial<SceneNode>]> = []
  for (const [id, previous] of journal.before) {
    const current = graph.getNode(id)
    if (!current || journal.deleted.has(id)) continue
    const changes: Partial<SceneNode> = {}
    for (const key of Object.keys(previous) as (keyof SceneNode)[]) {
      if (!isEqual(previous[key], current[key]))
        Object.assign(changes, { [key]: structuredClone(current[key]) })
    }
    if (Object.keys(changes).length > 0) updated.push([id, changes])
  }
  const created = [...journal.created]
    .map((id) => graph.getNode(id))
    .filter((node) => node !== undefined)
    .map((node) => [node.id, structuredClone(node)] as [string, SceneNode])
  return {
    created,
    updated,
    deleted: [...journal.deleted],
    populatedRootIds: [...populatedRootIds]
  }
}

/** Where a page load applied over edits made while it loaded differs from what it brought. */
export interface FigPopulationRebase {
  /** Layers whose state here is not the loaded one: the worker takes this thread's state. */
  diverged: string[]
  /** New instances of components edited while the page loaded, built from them as they were. */
  staleInstances: string[]
}

/** The components holding `ids`, or being them. */
function componentsHolding(graph: SceneGraph, ids: Iterable<string>): Set<string> {
  const components = new Set<string>()
  for (const id of ids) {
    let node = graph.getNode(id)
    while (node) {
      if (node.type === 'COMPONENT') components.add(node.id)
      node = node.parentId ? graph.getNode(node.parentId) : undefined
    }
  }
  return components
}

/**
 * A page load applied as it arrives: the worker sends a large page's new layers in pieces, each
 * applied in its own task so the editor keeps responding, then the changes to layers already
 * here. `edited` holds the layers this thread changed after the load began; the load did not see
 * those edits, so they win: fields of an edited layer stay as edited, a layer removed meanwhile
 * keeps the new layers out, and the new layers still join an edited parent.
 */
export function beginFigPopulation(graph: SceneGraph) {
  const diverged: string[] = []
  const created: string[] = []
  const createdIds = new Set<string>()
  return {
    /** How many new layers it has added. */
    get created(): number {
      return created.length
    },
    /** Adds new layers, each after its parent. */
    add(nodes: Iterable<SceneNode>): void {
      graph.applyImportedStateDuring(() => {
        for (const node of nodes) {
          if (graph.getNode(node.id) || (node.parentId && !graph.getNode(node.parentId))) {
            diverged.push(node.id)
            continue
          }
          graph.createNodeWithId(node.id, node.type, node.parentId, node)
          created.push(node.id)
          createdIds.add(node.id)
        }
      })
    },
    finish(
      changes: Pick<FigPopulationDelta, 'updated' | 'deleted'>,
      edited: ReadonlySet<string> = new Set()
    ): FigPopulationRebase {
      graph.applyImportedStateDuring(() => {
        for (const [id, fields] of changes.updated) {
          if (!edited.has(id)) {
            graph.updateNode(id, fields)
            continue
          }
          diverged.push(id)
          const node = graph.getNode(id)
          const joining = fields.childIds?.filter(
            (childId) => createdIds.has(childId) && !node?.childIds.includes(childId)
          )
          if (node && joining?.length) {
            graph.updateNode(id, { childIds: [...node.childIds, ...joining] })
          }
        }
        for (const id of changes.deleted) {
          if (edited.has(id)) diverged.push(id)
          else graph.deleteNode(id)
        }
      })
      const editedComponents =
        edited.size > 0 ? componentsHolding(graph, edited) : new Set<string>()
      const staleInstances = created.filter((id) => {
        const node = graph.getNode(id)
        return (
          node?.type === 'INSTANCE' && !!node.componentId && editedComponents.has(node.componentId)
        )
      })
      return { diverged, staleInstances }
    },
    /**
     * Removes the layers added so far, for a load that will not finish. A layer someone put
     * inside one of them meanwhile is not the load's: it moves out to the nearest layer that
     * stays, keeping its place on the canvas, before the load's layer goes.
     */
    rollback(): void {
      graph.applyImportedStateDuring(() => {
        for (const id of created.toReversed()) {
          const node = graph.getNode(id)
          if (!node) continue
          const parentId = node.parentId
          for (const childId of node.childIds.filter((childId) => !createdIds.has(childId))) {
            if (parentId) graph.reparentNode(childId, parentId)
          }
          graph.deleteNode(id)
        }
      })
      created.length = 0
      createdIds.clear()
    }
  }
}

export type FigPopulation = ReturnType<typeof beginFigPopulation>

/** Applies a whole page load at once; see `beginFigPopulation`. */
export function applyFigPopulationDelta(
  graph: SceneGraph,
  delta: FigPopulationDelta,
  edited: ReadonlySet<string> = new Set()
): FigPopulationRebase {
  const population = beginFigPopulation(graph)
  population.add(delta.created.map(([, node]) => node))
  return population.finish(delta, edited)
}
