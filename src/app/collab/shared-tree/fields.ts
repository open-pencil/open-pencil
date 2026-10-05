import * as v from 'valibot'
import * as Y from 'yjs'

import { randomIndex } from '@open-pencil/scene-graph/random'

/**
 * How a shared document records the layer tree. Each layer's map holds `parents`, a nested map
 * from every parent the layer has been moved under to the move counter, and `orderKey`, its
 * fractional position among siblings, and `page`, the page this peer last placed it on, where it
 * goes once no recorded parent is left; `parentId` and `childIds` are derived on each peer
 * (`src/app/collab/tree/layer-tree.ts`). The document-wide `meta` map holds the claims on the
 * room's root, the move clock, and the tree format.
 */
export const TREE_FORMAT = 2
export const PARENTS_FIELD = 'parents'
export const ORDER_KEY_FIELD = 'orderKey'
export const PAGE_FIELD = 'page'

const ROOT_CLAIM_PREFIX = 'root:'
const CLOCK_KEY = 'clock'
const FORMAT_KEY = 'treeFormat'
const KEY_SUFFIX_LENGTH = 3
const KEY_SUFFIX_FIRST = 33 // '!'
const KEY_SUFFIX_RANGE = 94 // '!' to '~'
const MAX_ORDER_KEY_LENGTH = 4096

export type YNodes = Y.Map<Y.Map<unknown>>
export type YMeta = Y.Map<unknown>

const counterSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0))
const orderKeySchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(MAX_ORDER_KEY_LENGTH),
  v.regex(/^[\x20-\x7e]+$/)
)
const pageSchema = v.pipe(v.string(), v.minLength(1))

export function readCounter(value: unknown): number | undefined {
  const result = v.safeParse(counterSchema, value)
  return result.success ? result.output : undefined
}

/** A layer's parent entries, or undefined when its map does not record them yet. */
export function readParentEntries(ynode: Y.Map<unknown>): Map<string, number> | undefined {
  const parents = ynode.get(PARENTS_FIELD)
  if (!(parents instanceof Y.Map)) return undefined
  const entries = new Map<string, number>()
  for (const [parentId, value] of parents.entries()) {
    const counter = readCounter(value)
    if (counter !== undefined) entries.set(parentId, counter)
  }
  return entries
}

export function readOrderKey(ynode: Y.Map<unknown>): string | undefined {
  const result = v.safeParse(orderKeySchema, ynode.get(ORDER_KEY_FIELD))
  return result.success ? result.output : undefined
}

export function readPage(ynode: Y.Map<unknown>): string | undefined {
  const result = v.safeParse(pageSchema, ynode.get(PAGE_FIELD))
  return result.success ? result.output : undefined
}

/**
 * The room's root: the earliest of the claims `meta` records as `root:<id>`, each the time a peer
 * shared that root, ties broken by id. A guest who edits before the room reaches them claims it
 * too, so the earliest claim, normally the sharer's, keeps every peer on the same root. Each claim
 * is its own key, so concurrent claims all survive.
 */
export function readRoot(meta: YMeta): string | undefined {
  let root: { id: string; claimedAt: number } | undefined
  for (const [key, value] of meta.entries()) {
    if (!key.startsWith(ROOT_CLAIM_PREFIX)) continue
    const id = key.slice(ROOT_CLAIM_PREFIX.length)
    const claimedAt = readCounter(value)
    if (claimedAt === undefined || id.length === 0) continue
    if (!root || claimedAt < root.claimedAt || (claimedAt === root.claimedAt && id < root.id)) {
      root = { id, claimedAt }
    }
  }
  return root?.id
}

export function claimRoot(meta: YMeta, rootId: string, claimedAt: number): void {
  const key = ROOT_CLAIM_PREFIX + rootId
  if (!meta.has(key)) meta.set(key, claimedAt)
}

export function writeParentEntry(ynode: Y.Map<unknown>, parentId: string, counter: number): void {
  let parents = ynode.get(PARENTS_FIELD)
  if (!(parents instanceof Y.Map)) {
    parents = new Y.Map<number>()
    ynode.set(PARENTS_FIELD, parents)
  }
  if (parents instanceof Y.Map && parents.get(parentId) !== counter) parents.set(parentId, counter)
}

/** Marks the root: a layer whose `parents` map is empty. */
export function writeRootEntries(ynode: Y.Map<unknown>): void {
  if (!(ynode.get(PARENTS_FIELD) instanceof Y.Map)) ynode.set(PARENTS_FIELD, new Y.Map<number>())
}

export function writeOrderKey(ynode: Y.Map<unknown>, orderKey: string): void {
  if (ynode.get(ORDER_KEY_FIELD) !== orderKey) ynode.set(ORDER_KEY_FIELD, orderKey)
}

export function writePage(ynode: Y.Map<unknown>, pageId: string): void {
  if (ynode.get(PAGE_FIELD) !== pageId) ynode.set(PAGE_FIELD, pageId)
}

/** Random printable characters for an order key, so concurrent inserts do not share a key. */
export function randomKeySuffix(): string {
  let suffix = ''
  for (let index = 0; index < KEY_SUFFIX_LENGTH; index++) {
    suffix += String.fromCharCode(KEY_SUFFIX_FIRST + randomIndex(KEY_SUFFIX_RANGE))
  }
  return suffix
}

/**
 * A Lamport clock for moves: one more than the highest counter this peer has seen, from the
 * document's `meta.clock` or any layer's entries. Concurrent moves may share a counter; the
 * parent id breaks the tie.
 */
export function createMoveClock() {
  let highest = 0
  return {
    next(meta: YMeta, seen: number): number {
      highest = Math.max(highest, seen, readCounter(meta.get(CLOCK_KEY)) ?? 0) + 1
      meta.set(CLOCK_KEY, highest)
      return highest
    }
  }
}

export function markTreeFormat(meta: YMeta): void {
  if (meta.get(FORMAT_KEY) !== TREE_FORMAT) meta.set(FORMAT_KEY, TREE_FORMAT)
}
