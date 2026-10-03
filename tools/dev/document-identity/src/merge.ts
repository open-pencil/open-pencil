import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'

import * as v from 'valibot'
import * as Y from 'yjs'

import type { SceneGraph } from '@open-pencil/scene-graph'

import type { encodeNodeForYjs } from '@/app/collab/node-codec'
import { decodeNodeFromYjs, syncEncodedNodeToYMap } from '@/app/collab/node-codec'

import { fixture, fork } from './fixture'

const reviewNodeSchema = v.object({
  id: v.string(),
  type: v.string(),
  name: v.string(),
  parentId: v.nullable(v.string()),
  childIds: v.array(v.string()),
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number()
})
const reviewSchema = v.record(v.string(), reviewNodeSchema)
type ReviewNode = v.InferOutput<typeof reviewNodeSchema>
type Review = v.InferOutput<typeof reviewSchema>
type EncodedNodeValue = ReturnType<typeof encodeNodeForYjs>[string]
type Mutation = (graph: SceneGraph, ids: ReturnType<typeof fixture>) => void
interface Scenario {
  name: string
  left: Mutation
  right: Mutation
}

function review(graph: SceneGraph): Review {
  return Object.fromEntries(
    [...graph.nodes]
      .sort(([a], [b]) => (a < b ? -1 : Number(a > b)))
      .map(([id, node]) => [id, v.parse(reviewNodeSchema, node)])
  )
}

function hierarchyIssues(nodes: Review): string[] {
  const issues = new Set<string>()
  for (const node of Object.values(nodes)) {
    if (node.parentId && !nodes[node.parentId]?.childIds.includes(node.id)) {
      issues.add(`${node.id} is absent from parent ${node.parentId}`)
    }
    for (const child of node.childIds) {
      if (nodes[child]?.parentId !== node.id)
        issues.add(`${node.id} has inconsistent child ${child}`)
    }
    const ancestors = new Set<string>([node.id])
    let parent = node.parentId
    while (parent && nodes[parent]) {
      if (ancestors.has(parent)) {
        issues.add(`Cycle containing ${node.id}`)
        break
      }
      ancestors.add(parent)
      parent = nodes[parent].parentId
    }
  }
  return [...issues]
}

function applyGraph(doc: Y.Doc, graph: SceneGraph) {
  const nodes = doc.getMap<Y.Map<EncodedNodeValue>>('nodes')
  doc.transact(() => {
    for (const id of nodes.keys()) if (!graph.nodes.has(id)) nodes.delete(id)
    for (const node of graph.nodes.values()) {
      let entry = nodes.get(node.id)
      if (!entry) {
        entry = new Y.Map<EncodedNodeValue>()
        nodes.set(node.id, entry)
      }
      syncEncodedNodeToYMap(node, entry)
    }
  })
}

function readDoc(doc: Y.Doc): Review {
  const nodes = doc.getMap<Y.Map<EncodedNodeValue>>('nodes')
  return Object.fromEntries(
    [...nodes]
      .sort(([a], [b]) => (a < b ? -1 : Number(a > b)))
      .map(([id, node]) => [id, v.parse(reviewNodeSchema, decodeNodeFromYjs(node))])
  )
}

function mergeYjs(base: SceneGraph, leftGraph: SceneGraph, rightGraph: SceneGraph) {
  const seed = new Y.Doc()
  const left = new Y.Doc()
  const right = new Y.Doc()
  try {
    applyGraph(seed, base)
    const update = Y.encodeStateAsUpdate(seed)
    Y.applyUpdate(left, update)
    Y.applyUpdate(right, update)
    applyGraph(left, leftGraph)
    applyGraph(right, rightGraph)
    const leftUpdate = Y.encodeStateAsUpdate(left)
    const rightUpdate = Y.encodeStateAsUpdate(right)
    Y.applyUpdate(left, rightUpdate)
    Y.applyUpdate(right, leftUpdate)
    const merged = readDoc(left)
    assert.deepEqual(merged, readDoc(right), 'Yjs peers must converge')
    return { converged: true, nodes: merged, hierarchyIssues: hierarchyIssues(merged) }
  } finally {
    seed.destroy()
    left.destroy()
    right.destroy()
  }
}

export function semanticChanges(before: Review, after: Review) {
  const fields: ReadonlyArray<keyof ReviewNode> = [
    'type',
    'name',
    'parentId',
    'childIds',
    'x',
    'y',
    'width',
    'height'
  ]
  const changes: string[] = []
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[id]
    const b = after[id]
    if (!a || !b) {
      changes.push(`${b ? 'Added' : 'Removed'} ${id} (${(b ?? a).name})`)
      continue
    }
    for (const field of fields) {
      if (JSON.stringify(a[field]) !== JSON.stringify(b[field])) {
        changes.push(
          `${id} (${b.name}).${field}: ${JSON.stringify(a[field])} → ${JSON.stringify(b[field])}`
        )
      }
    }
  }
  return changes
}

const scenarios: Scenario[] = [
  {
    name: 'independent-nodes',
    left: (g, { card }) => g.updateNode(card.id, { x: 20 }),
    right: (g, { other }) => g.updateNode(other.id, { width: 80 })
  },
  {
    name: 'same-node-different-fields',
    left: (g, { card }) => g.updateNode(card.id, { x: 20 }),
    right: (g, { card }) => g.updateNode(card.id, { height: 80 })
  },
  {
    name: 'same-field-conflict',
    left: (g, { card }) => g.updateNode(card.id, { x: 20 }),
    right: (g, { card }) => g.updateNode(card.id, { x: 30 })
  },
  {
    name: 'concurrent-sibling-additions',
    left: (g, { page }) => {
      g.createNode('RECTANGLE', page.id, { name: 'Left addition' })
    },
    right: (g, { page }) => {
      g.createNode('RECTANGLE', page.id, { name: 'Right addition' })
    }
  },
  {
    name: 'delete-versus-edit',
    left: (g, { card }) => g.deleteNode(card.id),
    right: (g, { card }) => g.updateNode(card.id, { x: 20 })
  },
  {
    name: 'concurrent-reparent-cycle',
    left: (g, { card, other }) => g.reparentNode(card.id, other.id),
    right: (g, { card, other }) => g.reparentNode(other.id, card.id)
  }
]

export async function probeMerges(output: string) {
  const results = []
  for (const scenario of scenarios) {
    const ids = fixture()
    const base = ids.graph
    const left = fork(base)
    const right = fork(base)
    scenario.left(left, ids)
    scenario.right(right, ids)
    assert.deepEqual(hierarchyIssues(review(left)), [])
    assert.deepEqual(hierarchyIssues(review(right)), [])
    const directory = `${output}/merge/${scenario.name}`
    mkdirSync(directory, { recursive: true })
    for (const [name, graph] of [
      ['base', base],
      ['left', left],
      ['right', right]
    ] satisfies Array<[string, SceneGraph]>) {
      await Bun.write(`${directory}/${name}.json`, `${JSON.stringify(review(graph), null, 2)}\n`)
    }
    const result = Bun.spawnSync([
      'git',
      'merge-file',
      '-p',
      `${directory}/left.json`,
      `${directory}/base.json`,
      `${directory}/right.json`
    ])
    assert.ok(result.exitCode >= 0 && result.exitCode < 128, result.stderr.toString())
    const text = result.stdout.toString()
    await Bun.write(`${directory}/git-merged.json`, text)
    const gitNodes = result.exitCode === 0 ? v.parse(reviewSchema, JSON.parse(text)) : null
    const yjs = mergeYjs(base, left, right)
    await Bun.write(`${directory}/yjs-merged.json`, `${JSON.stringify(yjs.nodes, null, 2)}\n`)
    results.push({
      name: scenario.name,
      git: {
        conflicts: result.exitCode,
        hierarchyIssues: gitNodes ? hierarchyIssues(gitNodes) : [],
        changes: gitNodes ? semanticChanges(review(base), gitNodes) : []
      },
      yjs: {
        converged: yjs.converged,
        hierarchyIssues: yjs.hierarchyIssues,
        changes: semanticChanges(review(base), yjs.nodes)
      }
    })
  }
  const additions = results.find((row) => row.name === 'concurrent-sibling-additions')
  assert.ok(
    additions && additions.yjs.hierarchyIssues.length > 0,
    'Current Yjs array-field representation should expose the concurrent-addition invariant gap'
  )
  const conflict = results.find((row) => row.name === 'same-field-conflict')
  assert.ok(conflict && conflict.git.conflicts > 0 && conflict.yjs.converged)
  const independent = results.find((row) => row.name === 'independent-nodes')
  assert.ok(independent && independent.git.conflicts === 0 && independent.yjs.changes.length === 2)
  const deletion = results.find((row) => row.name === 'delete-versus-edit')
  assert.ok(deletion?.yjs.changes.some((change) => change === 'Removed 41:3 (Card)'))
  const reparent = results.find((row) => row.name === 'concurrent-reparent-cycle')
  assert.ok(reparent?.yjs.hierarchyIssues.some((issue) => issue.startsWith('Cycle')))
  return results
}

export function projectGraph(graph: SceneGraph): Review {
  return review(graph)
}

/** Probe-only normalization: imported GUIDs plus FIG's fixed document-root identity. */
export function projectPersistedGraph(graph: SceneGraph): Review {
  const ids = new Map(
    [...graph.nodes.values()].map((node) => [
      node.id,
      node.id === graph.rootId ? '0:0' : (node.source.id ?? node.id)
    ])
  )
  assert.equal(new Set(ids.values()).size, ids.size, 'Persisted review identities must be unique')
  const mapped = (id: string) => {
    const value = ids.get(id)
    assert.ok(value, `Missing persisted identity for ${id}`)
    return value
  }
  return Object.fromEntries(
    Object.values(review(graph)).map((node) => [
      mapped(node.id),
      {
        ...node,
        id: mapped(node.id),
        parentId: node.parentId === null ? null : mapped(node.parentId),
        childIds: node.childIds.map(mapped)
      }
    ])
  )
}
