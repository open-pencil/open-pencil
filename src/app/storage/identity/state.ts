import type { StorageDocumentFormat } from '@/app/integrations/storage/types'
import {
  concatParts,
  encodeLength,
  encodeText,
  hashEnvelope
} from '@/app/storage/identity/envelope'

/**
 * Semantic identity of a document's metadata — the fields a conflict detector
 * must see: name, format, and trash state. Deliberately NOT `updatedAt` or
 * `trashedAt`: those are client clocks, and two devices trashing one document
 * at different times are the SAME semantic state — they must converge, not
 * conflict. `bodyId` alone cannot serve here: it excludes `meta.json` by
 * design, so a rename, a trash and a restore all leave it untouched.
 */
const META_ENVELOPE_VERSION = 1

function hashParts(parts: Uint8Array[]): Promise<string> {
  return hashEnvelope(concatParts(parts))
}

function pushText(parts: Uint8Array[], value: string): void {
  const bytes = encodeText(value)
  parts.push(encodeLength(bytes.byteLength), bytes)
}

export type StateMetadataInput = {
  name: string
  sourceFormat: StorageDocumentFormat
  /** Trash STATE as a boolean — never `trashedAt`, a client timestamp. */
  isTrashed: boolean
}

/**
 * Canonical metadata identity: length-prefixed fields with a schema version
 * tag, so `["ab","c"]` cannot hash equal to `["a","bc"]` and key ordering is
 * irrelevant. Identical concurrent edits produce identical ids — including
 * two devices renaming to the same string or trashing the same document.
 */
export async function computeMetaId(input: StateMetadataInput): Promise<string> {
  const parts: Uint8Array[] = []
  pushText(parts, `open-pencil/meta/v${META_ENVELOPE_VERSION}`)
  pushText(parts, input.name)
  pushText(parts, input.sourceFormat)
  pushText(parts, input.isTrashed ? '1' : '0')
  return hashParts(parts)
}

/**
 * Whole-document state identity: what a remote head must be compared against
 * to detect that someone else wrote. `bodyId` covers content, `metaId` covers
 * the metadata-only mutation class (rename, trash, restore) that body identity
 * is blind to; conflict if EITHER half moved from the base an edit started from.
 */
export async function computeStateId(bodyId: string, metaId: string): Promise<string> {
  const parts: Uint8Array[] = []
  pushText(parts, `open-pencil/state/v${META_ENVELOPE_VERSION}`)
  pushText(parts, bodyId)
  pushText(parts, metaId)
  return hashParts(parts)
}

/** Both halves of the identity for one metadata state, hashed once each. */
export async function computeStateIdentity(
  bodyId: string,
  input: StateMetadataInput
): Promise<{ metaId: string; stateId: string }> {
  const metaId = await computeMetaId(input)
  return { metaId, stateId: await computeStateId(bodyId, metaId) }
}
