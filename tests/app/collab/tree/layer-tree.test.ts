import { describe, expect, test } from 'bun:test'

import { create as createPRNG, oneOf, real53 } from 'lib0/prng'

import type { ParentEntries } from '@/app/collab/tree/entries'
import { LayerTree } from '@/app/collab/tree/layer-tree'

const ROOT = 'root'
const PAGE = 'page'

type LayerRecord = { entries: Map<string, number>; orderKey: string | undefined }
type TreeState = Map<string, LayerRecord>

function seedState(layers: Record<string, string>): TreeState {
  const state: TreeState = new Map([
    [ROOT, { entries: new Map(), orderKey: undefined }],
    [PAGE, { entries: new Map([[ROOT, 0]]), orderKey: '!' }]
  ])
  for (const [id, parentId] of Object.entries(layers)) {
    state.set(id, { entries: new Map([[parentId, 0]]), orderKey: 'O' })
  }
  return state
}

function treeOf(state: TreeState): LayerTree {
  const tree = new LayerTree({ orphanParentOf: (id) => (id === PAGE ? ROOT : PAGE) })
  for (const [id, layer] of state) tree.setLayer(id, new Map(layer.entries), layer.orderKey)
  tree.resolve()
  return tree
}

function parents(tree: LayerTree, ids: Iterable<string>): Record<string, string | null> {
  const result: Record<string, string | null> = {}
  for (const id of ids) result[id] = tree.parentOf(id) ?? null
  return result
}

/** Every layer reaches the root without visiting a layer twice. */
function expectAcyclic(tree: LayerTree, ids: Iterable<string>) {
  for (const id of ids) {
    const seen = new Set<string>()
    for (let current: string | null | undefined = id; current != null;) {
      expect(seen.has(current)).toBe(false)
      seen.add(current)
      current = tree.parentOf(current)
    }
    expect(seen.has(ROOT)).toBe(true)
  }
}

function move(state: TreeState, id: string, parentId: string, counter: number) {
  const layer = state.get(id)
  if (!layer) throw new Error(`no layer ${id}`)
  layer.entries.set(parentId, counter)
}

describe('layer tree resolution', () => {
  test('a layer sits under its newest parent, ties broken by parent id', () => {
    const state = seedState({ a: PAGE, b: PAGE, x: PAGE })
    move(state, 'x', 'a', 3)
    move(state, 'x', 'b', 3)
    expect(treeOf(state).parentOf('x')).toBe('b')
    move(state, 'x', 'a', 4)
    expect(treeOf(state).parentOf('x')).toBe('a')
  })

  test('two layers moved into each other keep the earlier move', () => {
    const state = seedState({ a: PAGE, b: PAGE })
    move(state, 'a', 'b', 1)
    move(state, 'b', 'a', 2)
    const tree = treeOf(state)
    expect(parents(tree, ['a', 'b'])).toEqual({ a: 'b', b: PAGE })
    expect(tree.isDisplaced('b')).toBe(true)
    expectAcyclic(tree, ['a', 'b'])
  })

  test('a three-layer loop drops only its latest move', () => {
    const state = seedState({ a: PAGE, b: PAGE, c: PAGE })
    move(state, 'a', 'b', 1)
    move(state, 'b', 'c', 3)
    move(state, 'c', 'a', 2)
    const tree = treeOf(state)
    expect(parents(tree, ['a', 'b', 'c'])).toEqual({ a: 'b', b: PAGE, c: 'a' })
    expectAcyclic(tree, ['a', 'b', 'c'])
  })

  test('a loop of equal counters drops the move of the highest layer id', () => {
    const state = seedState({ a: PAGE, b: PAGE })
    move(state, 'a', 'b', 1)
    move(state, 'b', 'a', 1)
    expect(parents(treeOf(state), ['a', 'b'])).toEqual({ a: 'b', b: PAGE })
  })

  test('a layer falls back past every entry that closes a loop', () => {
    const state = seedState({ f: PAGE, a: 'f', b: 'f', x: 'f' })
    move(state, 'a', 'x', 1)
    move(state, 'b', 'x', 2)
    move(state, 'x', 'a', 3)
    move(state, 'x', 'b', 4)
    // x's moves into b and then into a each close a loop and are later than the move they meet.
    const tree = treeOf(state)
    expect(parents(tree, ['x', 'a', 'b'])).toEqual({ x: 'f', a: 'x', b: 'x' })
    expectAcyclic(tree, ['x', 'a', 'b', 'f'])
  })

  test('a layer whose newest parent was deleted falls back to its previous one', () => {
    const state = seedState({ f: PAGE, g: PAGE, x: PAGE })
    move(state, 'x', 'f', 1)
    move(state, 'x', 'g', 2)
    const tree = treeOf(state)
    expect(tree.parentOf('x')).toBe('g')
    tree.deleteLayer('g')
    expect(tree.resolve()).toEqual([{ layerId: 'x', from: 'g', to: 'f' }])
    expect(tree.isDisplaced('x')).toBe(true)
  })

  test('a layer with no remaining parent goes to its page', () => {
    const state = seedState({ f: PAGE, x: 'f' })
    const tree = treeOf(state)
    tree.deleteLayer('f')
    tree.resolve()
    expect(tree.parentOf('x')).toBe(PAGE)
  })

  test('a displaced layer returns when its newest parent comes back', () => {
    const state = seedState({ f: PAGE, x: 'f' })
    move(state, 'x', 'g', 1)
    const tree = treeOf(state)
    expect(tree.parentOf('x')).toBe('f')
    tree.setLayer('g', new Map([[PAGE, 2]]), 'a')
    tree.resolve()
    expect(tree.parentOf('x')).toBe('g')
    expect(tree.isDisplaced('x')).toBe(false)
  })

  test('siblings sort by order key, then by id', () => {
    const tree = new LayerTree({ orphanParentOf: () => PAGE })
    tree.setLayer(ROOT, new Map(), undefined)
    tree.setLayer(PAGE, new Map([[ROOT, 0]]), '!')
    tree.setLayer('c', new Map([[PAGE, 0]]), 'a')
    tree.setLayer('b', new Map([[PAGE, 0]]), 'b')
    tree.setLayer('a', new Map([[PAGE, 0]]), 'b')
    tree.resolve()
    expect(tree.childrenOf(PAGE)).toEqual(['c', 'a', 'b'])
  })

  test('reports the displaced layers on a move path so the move can keep them', () => {
    const state = seedState({ a: PAGE, b: PAGE })
    move(state, 'a', 'b', 1)
    move(state, 'b', 'a', 2)
    const tree = treeOf(state)
    expect(tree.displacedAncestors(['a'])).toEqual(['b'])
    expect(tree.displacedAncestors([PAGE])).toEqual([])
  })
})

interface SimPeer {
  state: TreeState
  deleted: Set<string>
  tree: LayerTree
  clock: number
}

function createPeer(state: TreeState): SimPeer {
  return { state: cloneState(state), deleted: new Set(), tree: treeOf(state), clock: 0 }
}

function cloneState(state: TreeState): TreeState {
  return new Map(
    [...state].map(([id, layer]) => [
      id,
      { entries: new Map(layer.entries), orderKey: layer.orderKey }
    ])
  )
}

function isUnder(tree: LayerTree, id: string, ancestorId: string): boolean {
  const seen = new Set<string>()
  for (let current: string | null | undefined = id; current != null;) {
    if (current === ancestorId) return true
    if (seen.has(current)) return false
    seen.add(current)
    current = tree.parentOf(current)
  }
  return false
}

/** A local move as the app makes one: newest counter, and displaced ancestors re-recorded. */
function moveOnPeer(peer: SimPeer, id: string, parentId: string) {
  const counter = Math.max(peer.clock, peer.tree.maxCounter) + 1
  peer.clock = counter
  const keep = peer.tree.displacedAncestors([peer.tree.parentOf(id), parentId])
  for (const keptId of keep) {
    const keptParent = peer.tree.parentOf(keptId)
    if (keptParent == null) continue
    move(peer.state, keptId, keptParent, counter)
    peer.tree.placeLocally(keptId, keptParent, counter)
  }
  move(peer.state, id, parentId, counter)
  peer.tree.placeLocally(id, parentId, counter)
}

function deleteOnPeer(peer: SimPeer, id: string) {
  const subtree = [id]
  // Iterating an array visits the elements pushed onto it during the loop.
  for (const current of subtree) subtree.push(...peer.tree.childrenOf(current))
  for (const removed of subtree) {
    peer.state.delete(removed)
    peer.deleted.add(removed)
    peer.tree.deleteLayer(removed)
  }
  peer.tree.resolve()
}

/** Delivers `from`'s state to `to`: deletions win, and each entry keeps its highest counter. */
function deliver(from: SimPeer, to: SimPeer) {
  for (const id of from.deleted) {
    if (to.deleted.has(id)) continue
    to.deleted.add(id)
    to.state.delete(id)
    to.tree.deleteLayer(id)
  }
  for (const [id, layer] of from.state) {
    if (to.deleted.has(id)) continue
    const target = to.state.get(id)
    if (!target) continue
    let changed = false
    for (const [parentId, counter] of layer.entries) {
      if ((target.entries.get(parentId) ?? -1) < counter) {
        target.entries.set(parentId, counter)
        changed = true
      }
    }
    if (changed) to.tree.setLayer(id, new Map(target.entries) as ParentEntries, target.orderKey)
  }
  to.tree.resolve()
}

describe('layer tree convergence', () => {
  for (const seed of Array.from({ length: 20 }, (_, index) => index + 1)) {
    test(`random concurrent moves and deletes converge (seed ${seed})`, () => {
      const random = createPRNG(seed)
      const pick = <T>(items: readonly T[]): T => oneOf(random, items.slice())
      const layout: Record<string, string> = {}
      const ids = Array.from({ length: 10 }, (_, index) => `n${index}`)
      for (const [index, id] of ids.entries()) {
        layout[id] = index < 3 ? PAGE : pick(ids.slice(0, index))
      }
      const initial = seedState(layout)
      const peers = [createPeer(initial), createPeer(initial), createPeer(initial)]

      for (let round = 0; round < 8; round++) {
        for (let step = 0; step < 12; step++) {
          const peer = pick(peers)
          const alive = ids.filter((id) => peer.tree.has(id))
          if (alive.length === 0) continue
          const id = pick(alive)
          if (real53(random) < 0.06) {
            deleteOnPeer(peer, id)
            continue
          }
          const targets = [PAGE, ...alive].filter((target) => !isUnder(peer.tree, target, id))
          moveOnPeer(peer, id, pick(targets))
        }
        for (const from of peers) for (const to of peers) if (from !== to) deliver(from, to)

        const reference = peers[0]
        const alive = ids.filter((id) => reference.tree.has(id))
        expectAcyclic(reference.tree, alive)
        const fresh = treeOf(reference.state)
        expect(parents(fresh, alive)).toEqual(parents(reference.tree, alive))
        for (const peer of peers.slice(1)) {
          expect(parents(peer.tree, alive)).toEqual(parents(reference.tree, alive))
        }
      }
    })
  }
})
