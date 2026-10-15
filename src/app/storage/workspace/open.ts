import { saveLocalFile } from '@/app/document/io/save'
import { DECK_FILE_TYPE } from '@/app/document/io/save-targets'
import {
  createActiveStorageAdapter,
  type StorageDocument,
  type StorageProviderID,
  type StorageTransferProgress
} from '@/app/integrations/storage'
import { currentStorageDestination } from '@/app/storage/destination'
import { getLocalCanvasStore, type LocalCanvasMeta } from '@/app/storage/local-store'
import { seedStorageCanvasFromRemote } from '@/app/storage/sync/persist'

/** A library design as the open path needs it. */
export type LibraryDesign = Pick<
  StorageDocument,
  'id' | 'name' | 'updatedAt' | 'sourceFormat' | 'stateId' | 'metadataAuthoritative'
>

/** Slide decks are listed and synced, but this version of OpenPencil cannot open one. */
export class SlideDeckNotOpenableError extends Error {
  constructor(name: string) {
    super(`"${name}" is a slide deck, which this version of OpenPencil cannot open`)
    this.name = 'SlideDeckNotOpenableError'
  }
}

/** Whether a design is a slide deck, by its listing or by the row on this device. */
export async function isSlideDeck(design: Pick<LibraryDesign, 'id' | 'sourceFormat'>) {
  if (design.sourceFormat === 'deck') return true
  return (await getLocalCanvasStore().getMeta(design.id))?.sourceFormat === 'deck'
}

/**
 * Local bytes serve an open only when they are the listed state: the row holds local edits, or
 * it is clean at the listed state (a legacy listing compares timestamps instead).
 */
function localBytesAreCurrent(row: LocalCanvasMeta, design: LibraryDesign): boolean {
  if (row.syncStatus !== 'synced') return true
  if (design.stateId) return row.baseStateId === design.stateId
  return !design.metadataAuthoritative || row.updatedAt >= design.updatedAt
}

export type ReadLibraryOptions = {
  /** Download progress when the design is read from storage. */
  onTransfer?: (progress: StorageTransferProgress) => void
  signal?: AbortSignal
}

/**
 * The bytes of a library design: from this device when they are current, else downloaded and
 * cached with the state they belong to, which becomes the base of later edits.
 */
export async function readLibraryDesign(
  design: LibraryDesign,
  providerId: StorageProviderID,
  options: ReadLibraryOptions = {}
): Promise<Uint8Array> {
  const store = getLocalCanvasStore()
  const row = await store.getMeta(design.id)
  options.signal?.throwIfAborted()
  const localBytes = row?.hasFig ? await store.readFig(design.id) : null
  options.signal?.throwIfAborted()
  if (row && localBytes && localBytes.byteLength > 0 && localBytesAreCurrent(row, design)) {
    return localBytes
  }

  const adapter = createActiveStorageAdapter(providerId)
  if (!adapter.getDocumentVersion) {
    const bytes = await adapter.getDocument(design.id, options.onTransfer, options.signal)
    await seedStorageCanvasFromRemote({
      providerId,
      canvasId: design.id,
      name: design.name,
      updatedAt: design.updatedAt,
      sourceFormat: design.sourceFormat,
      figBytes: bytes,
      syncDestination: currentStorageDestination(providerId)
    })
    return bytes
  }
  const version = await adapter.getDocumentVersion(design.id, options.onTransfer, options.signal)
  await seedStorageCanvasFromRemote({
    providerId,
    canvasId: design.id,
    name: version.metadata.name,
    updatedAt: version.metadata.updatedAt,
    sourceFormat: version.metadata.sourceFormat,
    trashedAt: version.metadata.trashedAt,
    figBytes: version.bytes,
    baseStateId: version.metadata.stateId ?? null,
    remoteBodyId: version.metadata.bodyId ?? null,
    versioned: version.versioned,
    syncDestination: currentStorageDestination(providerId)
  })
  options.signal?.throwIfAborted()
  return version.bytes
}

/** Save a slide deck's bytes as a `.deck` file; the deck itself stays as it is in the library. */
export async function downloadSlideDeck(
  design: LibraryDesign,
  providerId: StorageProviderID
): Promise<boolean> {
  const bytes = await readLibraryDesign(design, providerId)
  return saveLocalFile(bytes, `${design.name || 'Untitled'}.deck`, DECK_FILE_TYPE)
}
