import { zipSync } from 'fflate'

import type {
  StorageDocumentFormat,
  StorageDocumentMetadata
} from '@/app/integrations/storage/types'
import { computeBodyIdSafe } from '@/app/storage/identity/body'
import { computeStateIdentity } from '@/app/storage/identity/state'

/** A PNG header with usable dimensions: enough for the embedded-thumbnail reader. */
export function fakePNG(width = 4, height = 4): Uint8Array {
  const bytes = new Uint8Array(33)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const data = new DataView(bytes.buffer)
  data.setUint32(8, 13)
  bytes.set(new TextEncoder().encode('IHDR'), 12)
  data.setUint32(16, width)
  data.setUint32(20, height)
  return bytes
}

/** A `.fig`-shaped archive: a canvas payload, optionally with an embedded thumbnail. */
export function figArchive(canvas: string, thumbnail?: Uint8Array): Uint8Array {
  const entries: Record<string, Uint8Array> = { 'canvas.fig': new TextEncoder().encode(canvas) }
  if (thumbnail) entries['thumbnail.png'] = thumbnail
  return zipSync(entries, { level: 0 })
}

/** Metadata with the identity a commit needs, computed the way the sync engine does. */
export async function writtenFor(
  name: string,
  bytes: Uint8Array,
  options: {
    sourceFormat?: StorageDocumentFormat
    trashedAt?: string | null
    /** The design the state belongs to; most tests use `doc`. */
    documentId?: string
  } = {}
): Promise<StorageDocumentMetadata> {
  const sourceFormat = options.sourceFormat ?? 'fig'
  const trashedAt = options.trashedAt ?? null
  const bodyId = await computeBodyIdSafe(bytes, sourceFormat)
  const { stateId } = await computeStateIdentity(bodyId, {
    documentId: options.documentId ?? 'doc',
    name,
    sourceFormat,
    isTrashed: trashedAt !== null
  })
  return {
    name,
    updatedAt: '2026-08-04T12:00:00.000Z',
    sourceFormat,
    trashedAt,
    bodyId,
    stateId
  }
}
