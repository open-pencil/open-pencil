import { storageProviderRegistry, type StorageDocument } from '@/app/integrations/storage'
import type { LocalCanvasMeta } from '@/app/storage/local-store'
import { bodyIsConfirmed } from '@/app/storage/local-store/meta'
import { providerIdOfTarget, type StorageTargetID } from '@/app/storage/target'

/**
 * What the workspace shows, kept apart from where documents replicate.
 *
 * A document's location is an attribute of the document, never a predicate on
 * its existence in the list. `syncTargetId` answers "which bytes go where"; it
 * used to double as a visibility key here, and a row with no destination
 * therefore matched no filter and rendered nowhere at all — the exact defect
 * `local-store/types.ts` records as the reason `providerId` was replaced.
 *
 * Everything in this module is pure: one row plus the active target id in, a
 * decision out. No store reads, no adapters, no live preference lookups beyond
 * the static provider registry, so the rules are directly testable.
 */

export type StorageDocumentLocationKind =
  | 'backed-up-here'
  | 'backed-up-elsewhere'
  | 'backing-up'
  | 'detached'
  | 'device-only'

export type StorageDocumentLocation = {
  kind: StorageDocumentLocationKind
  /**
   * Label of the provider the badge names, or `null` when it names none —
   * including a target id from durable storage whose provider this build no
   * longer ships. The caller substitutes a neutral word for `null`.
   */
  providerLabel: string | null
}

/**
 * What the workspace knows about one row's whereabouts.
 *
 * `storageDocumentLocation` reads only the two target fields; `hasLocalBody`
 * answers the separate question of whether this device can open the document
 * without asking a bucket for it.
 */
export type StorageDocumentPlacement = {
  syncTargetId: StorageTargetID | null
  lastKnownTargetId?: StorageTargetID | null
  /** Bytes are cached here. An index-only row has metadata and nothing else. */
  hasLocalBody?: boolean
  /**
   * The destination has confirmed THESE bytes.
   *
   * Naming a destination is not the same as having reached it. Without this the
   * card said "Backed up to X" from the moment a document was pointed at X,
   * while its bytes were still queued — the card equivalent of a green tick
   * over an unsent upload, and the most dangerous claim this surface can make.
   */
  bodyConfirmed?: boolean
}

/** Kind plus the resolved sentence, so the card renders text it is handed. */
export type StorageDocumentLocationBadge = {
  kind: StorageDocumentLocationKind
  label: string
}

export type StorageDocumentScope = 'all' | 'active-target'

/**
 * Provider label for a target id, without throwing.
 *
 * `registry.has()` exists precisely so an id read back from durable storage
 * that names a provider this build no longer ships is a state to report rather
 * than an exception to raise; `providerIdOfTarget` already applies it.
 */
function providerLabelOfTarget(targetId: StorageTargetID): string | null {
  const providerId = providerIdOfTarget(targetId)
  return providerId === null ? null : storageProviderRegistry.get(providerId).label
}

/**
 * Where one document lives.
 *
 * The current destination is tested before the previous one: a row re-adopted
 * by a target carries both, and where it replicates NOW is the true answer.
 *
 * `syncTargetId === activeTargetId` is not sufficient on its own — with no
 * destination configured both sides are `null`, and a document with nowhere to
 * go would report itself as backed up here.
 */
export function storageDocumentLocation(
  placement: StorageDocumentPlacement,
  activeTargetId: StorageTargetID | null
): StorageDocumentLocation {
  // Nullish, not `!== null`: rows written before `syncTargetId` existed carry
  // `undefined`, and a strict null test sent every one of them down the
  // "replicates somewhere" branch — badging documents that live only on this
  // device as backed up to a provider they have never touched. Absent and null
  // mean the same thing here, and the badge is a claim about the user's data.
  const syncTargetId = placement.syncTargetId ?? null
  if (syncTargetId !== null) {
    // Undefined means "not recorded", which must not read as confirmed: an
    // index-only row has no local body to have uploaded.
    if (placement.bodyConfirmed === false) {
      return { kind: 'backing-up', providerLabel: providerLabelOfTarget(syncTargetId) }
    }
    return {
      kind: syncTargetId === activeTargetId ? 'backed-up-here' : 'backed-up-elsewhere',
      providerLabel: providerLabelOfTarget(syncTargetId)
    }
  }
  const lastKnownTargetId = placement.lastKnownTargetId ?? null
  if (lastKnownTargetId !== null) {
    return { kind: 'detached', providerLabel: providerLabelOfTarget(lastKnownTargetId) }
  }
  return { kind: 'device-only', providerLabel: null }
}

/** Card shape for a row held on this device; its metadata is authoritative. */
export function storageDocumentFromMeta(meta: LocalCanvasMeta): StorageDocument {
  return {
    id: meta.id,
    name: meta.name,
    updatedAt: meta.updatedAt,
    sourceFormat: meta.sourceFormat,
    trashedAt: meta.trashedAt,
    metadataAuthoritative: true
  }
}

function newestFirst(documents: StorageDocument[]): StorageDocument[] {
  return documents.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
}

/**
 * Every non-tombstoned row on this device, whatever its destination.
 *
 * Tombstones are excluded in every scope: a delete in flight is a lifecycle
 * state, not a location.
 */
export function deviceStorageDocuments(metas: readonly LocalCanvasMeta[]): StorageDocument[] {
  return newestFirst(metas.filter((meta) => !meta.tombstoned).map(storageDocumentFromMeta))
}

/**
 * The device-wide list after a listing of ONE target has been reconciled.
 *
 * `reconcileStorageDocuments` requires its input narrowed to the target that
 * produced the listing, and that narrowing stays — every absence-sensitive
 * output it computes is only meaningful under it. What must not stay narrowed
 * is the result: rows belonging to other destinations, and rows belonging to
 * none, are still documents on this device.
 *
 * Deliberately expressed as "every non-tombstoned row, with the reconciled
 * entry preferred where there is one" rather than "the reconciled rows plus the
 * rows at other targets". The second phrasing is the same shape as the defect
 * being fixed: it silently depends on the reconciliation covering the active
 * target exactly, and any row it failed to cover would disappear again.
 */
export function mergeDeviceStorageDocuments(
  reconciled: readonly StorageDocument[],
  metas: readonly LocalCanvasMeta[]
): StorageDocument[] {
  const tombstonedIds = new Set(metas.filter((meta) => meta.tombstoned).map((meta) => meta.id))
  const merged = new Map<string, StorageDocument>()
  for (const document of reconciled) {
    if (!tombstonedIds.has(document.id)) merged.set(document.id, document)
  }
  for (const meta of metas) {
    if (meta.tombstoned || merged.has(meta.id)) continue
    merged.set(meta.id, storageDocumentFromMeta(meta))
  }
  return newestFirst([...merged.values()])
}

/** Placement of every row, by document id, for badge and scope resolution. */
export function storageDocumentPlacements(
  metas: readonly LocalCanvasMeta[]
): Record<string, StorageDocumentPlacement> {
  const placements: Record<string, StorageDocumentPlacement> = {}
  for (const meta of metas) {
    placements[meta.id] = {
      syncTargetId: meta.syncTargetId ?? null,
      lastKnownTargetId: meta.lastKnownTargetId ?? null,
      hasLocalBody: meta.hasFig,
      // Only a row that HAS local bytes can be waiting to upload them; an
      // index-only row's body lives at the destination already.
      bodyConfirmed: meta.hasFig ? bodyIsConfirmed(meta) : true
    }
  }
  return placements
}

/**
 * Whether opening this row would have to ask a destination it does not belong
 * to for the bytes.
 *
 * An index-only row is metadata a listing produced; its bytes exist only at its
 * own target. Fetching that id from whichever destination happens to be active
 * asks a different bucket for a document it never held — the request fails with
 * that provider's own 404, and a collision would seed the row into the wrong
 * place. The row is still listed; it simply cannot be opened from here.
 */
export function storageDocumentNeedsItsOwnTarget(
  placement: StorageDocumentPlacement | undefined,
  activeTargetId: StorageTargetID | null
): boolean {
  if (placement?.hasLocalBody !== false) return false
  return placement.syncTargetId !== activeTargetId
}

/**
 * Whether a row survives the scope the user selected.
 *
 * A row with no placement was produced by the active target's own listing and
 * has not been written to the local index yet, so it belongs to that target.
 */
export function storageDocumentInScope(
  placement: StorageDocumentPlacement | undefined,
  scope: StorageDocumentScope,
  activeTargetId: StorageTargetID | null
): boolean {
  if (scope === 'all') return true
  if (!placement) return true
  return placement.syncTargetId !== null && placement.syncTargetId === activeTargetId
}
