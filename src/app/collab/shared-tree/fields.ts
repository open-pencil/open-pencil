import * as v from 'valibot'
import * as Y from 'yjs'

import { randomIndex } from '@open-pencil/scene-graph/random'

/**
 * How a shared document records the layer tree. Each layer's map holds `parents`, a nested map
 * from every parent the layer has been moved under to the move counter, and `orderKey`, its
 * fractional position among siblings, and `page`, the page this peer last placed it on, where it
 * goes once no recorded parent is left; `parentId` and `childIds` are derived on each peer
 * (`src/app/collab/tree/layer-tree.ts`). The document-wide `meta` map holds the room's root and
 * name, the move clock, and the tree format.
 */
export const TREE_FORMAT = 2
export const PARENTS_FIELD = 'parents'
export const ORDER_KEY_FIELD = 'orderKey'
export const PAGE_FIELD = 'page'

const ROOT_KEY = 'root'
const NAME_KEY = 'name'
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
const layerIdSchema = v.pipe(v.string(), v.minLength(1))
const MAX_ROOM_NAME_LENGTH = 256
const roomNameSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_ROOM_NAME_LENGTH))

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
  const result = v.safeParse(layerIdSchema, ynode.get(PAGE_FIELD))
  return result.success ? result.output : undefined
}

/**
 * The room's root: the root of the document someone shared into it, or the one a saved room's
 * conversion picked. Only Share and conversion write it, and a fresh room has one sharer while
 * converting peers pick the same root, so it never has two values; peers that joined never write
 * their own document into a room.
 */
export function readRoot(meta: YMeta): string | undefined {
  const result = v.safeParse(layerIdSchema, meta.get(ROOT_KEY))
  return result.success ? result.output : undefined
}

export function claimRoot(meta: YMeta, rootId: string): void {
  if (readRoot(meta) === undefined) meta.set(ROOT_KEY, rootId)
}

/** The name of the document shared into the room, so joiners' tabs show it. */
export function readRoomName(meta: YMeta): string | undefined {
  const result = v.safeParse(roomNameSchema, meta.get(NAME_KEY))
  return result.success ? result.output : undefined
}

export function writeRoomName(meta: YMeta, name: string): void {
  if (name.length > 0 && meta.get(NAME_KEY) !== name) meta.set(NAME_KEY, name)
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
