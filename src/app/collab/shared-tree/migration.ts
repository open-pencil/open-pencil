import * as v from 'valibot'
import * as Y from 'yjs'

import { siblingOrderKeys } from '@open-pencil/scene-graph/order-keys'

import { topEdge } from '@/app/collab/tree/entries'

import {
  claimRoot,
  markTreeFormat,
  PARENTS_FIELD,
  readOrderKey,
  readParentEntries,
  readRoot,
  writeOrderKey,
  writePage,
  writeParentEntry,
  writeRootEntries,
  type YMeta,
  type YNodes
} from './fields'

/** Fields format 1 synced directly and format 2 derives. */
const LEGACY_TREE_FIELDS = ['parentId', 'childIds'] as const
const legacyParentSchema = v.nullable(v.string())
const legacyChildIdsSchema = v.array(v.string())

/** The origin of a migration this peer writes; the change that triggered it applies it. */
export const TREE_MIGRATION_ORIGIN = Symbol('collab-tree-migration')

export function isLegacyLayer(ynode: Y.Map<unknown>): boolean {
  return !(ynode.get(PARENTS_FIELD) instanceof Y.Map) && ynode.has('parentId')
}

function legacyParentOf(ynode: Y.Map<unknown>): string | null | undefined {
  const result = v.safeParse(legacyParentSchema, ynode.get('parentId'))
  return result.success ? result.output : undefined
}

function legacyChildIdsOf(ynode: Y.Map<unknown> | undefined): string[] {
  const result = v.safeParse(legacyChildIdsSchema, ynode?.get('childIds'))
  return result.success ? result.output : []
}

/**
 * Converts layers a format 1 document recorded to format 2: each layer's synced parent becomes
 * its only entry, with counter 0, and its position in that parent's synced `childIds` becomes an
 * order key, and the page its synced ancestors reach becomes its page; siblings already converted
 * keep theirs. The root with the most children becomes the room's root. The result depends only on the document, so
 * peers that convert the same layers at once write the same values. Returns the converted ids.
 */
export function migrateLegacyLayers(
  ydoc: Y.Doc,
  ynodes: YNodes,
  meta: YMeta,
  layerIds: Iterable<string>
): string[] {
  const legacy = [...new Set(layerIds)].filter((id) => {
    const ynode = ynodes.get(id)
    return ynode !== undefined && isLegacyLayer(ynode)
  })
  if (legacy.length === 0) return []

  const byParent = new Map<string | null, Set<string>>()
  for (const id of legacy) {
    const parentId = legacyParentOf(ynodes.get(id) ?? new Y.Map())
    if (parentId === undefined) continue
    let siblings = byParent.get(parentId)
    if (!siblings) {
      siblings = new Set()
      byParent.set(parentId, siblings)
    }
    siblings.add(id)
  }

  // Pages are found before any layer drops its synced parent.
  const pages = new Map(legacy.map((id) => [id, legacyPageOf(ynodes, id)]))

  ydoc.transact(() => {
    for (const [parentId, migrating] of byParent) {
      if (parentId === null) {
        for (const id of migrating) {
          const ynode = ynodes.get(id)
          if (ynode) writeRootEntries(ynode)
        }
        claimLegacyRoot(ynodes, meta, migrating)
        continue
      }
      const listed = legacyChildIdsOf(ynodes.get(parentId)).filter(
        (id) => ynodes.get(id) && (migrating.has(id) || legacyParentOrEntry(ynodes, id, parentId))
      )
      const order = [...new Set(listed)]
      const unlisted = [...migrating].filter((id) => !order.includes(id)).sort()
      order.push(...unlisted)
      const keys = siblingOrderKeys(
        order.map((id) => {
          const ynode = ynodes.get(id)
          return ynode && !migrating.has(id) ? readOrderKey(ynode) : undefined
        })
      )
      order.forEach((id, index) => {
        const ynode = ynodes.get(id)
        if (!ynode || !migrating.has(id)) return
        writeParentEntry(ynode, parentId, 0)
        writeOrderKey(ynode, keys[index])
        const pageId = pages.get(id)
        if (pageId !== undefined) writePage(ynode, pageId)
      })
    }
    for (const id of legacy) {
      const ynode = ynodes.get(id)
      if (!ynode || !(ynode.get(PARENTS_FIELD) instanceof Y.Map)) continue
      for (const field of LEGACY_TREE_FIELDS) if (ynode.has(field)) ynode.delete(field)
    }
    markTreeFormat(meta)
  }, TREE_MIGRATION_ORIGIN)
  return legacy
}

/** Whether a converted sibling still lists `parentId` among its entries. */
function legacyParentOrEntry(ynodes: YNodes, id: string, parentId: string): boolean {
  const ynode = ynodes.get(id)
  return ynode !== undefined && readParentEntries(ynode)?.has(parentId) === true
}

/**
 * The nearest page above a layer, following each ancestor's synced parent, or its newest entry
 * once it has been converted. Undefined for the root and the pages themselves.
 */
function legacyPageOf(ynodes: YNodes, id: string): string | undefined {
  if (ynodes.get(id)?.get('type') === 'CANVAS') return undefined
  let current = ynodes.get(id)
  for (let steps = 0; current && steps < ynodes.size; steps++) {
    const entries = readParentEntries(current)
    const parentId = entries ? topEdge(entries)?.parentId : legacyParentOf(current)
    if (!parentId) return undefined
    current = ynodes.get(parentId)
    if (current?.get('type') === 'CANVAS') return parentId
  }
  return undefined
}

/**
 * Claims the room's root for a converted document. Format 1 rooms could hold several parentless
 * layers, such as a joiner's own document; the one with the most children, then the lowest id,
 * is the room's, so every converting peer claims the same one.
 */
function claimLegacyRoot(ynodes: YNodes, meta: YMeta, roots: ReadonlySet<string>): void {
  if (readRoot(meta) !== undefined) return
  // Sorting is stable, so roots with as many children stay in id order.
  const ranked = [...roots]
    .sort()
    .map((id) => ({ id, children: legacyChildIdsOf(ynodes.get(id)).length }))
    .sort((a, b) => b.children - a.children)
  const root = ranked.at(0)
  if (root) claimRoot(meta, root.id)
}
