import { unzipSync } from 'fflate'

import type { StorageDocumentFormat } from '@/app/integrations/storage/types'
import {
  concatParts,
  encodeLength,
  encodeText,
  hashEnvelope
} from '@/app/storage/identity/envelope'

/**
 * Identity of a document's logical body — the content a remote copy must hold.
 *
 * Hashing the archive bytes does not work: `fig/export.ts` embeds
 * `createdAt: new Date().toISOString()` in `meta.json`, and ZIP ordering and
 * compression metadata vary too, so two archives of identical content need not
 * share a single byte of framing. Saving twice without editing would look like
 * a change and re-upload the whole document.
 *
 * So the identity covers the content entries only, sorted by path, with a
 * format tag. Everything volatile or derived is excluded — renaming a document
 * or regenerating its thumbnail must not change its body identity.
 */
const ENVELOPE_VERSION = 1

/**
 * Entries excluded from identity.
 *
 * `meta.json` carries the export timestamp and the display name, both of which
 * change without the document changing. `thumbnail.png` is derived from the
 * canvas — if it differs while nothing else does, the body is still the same
 * body, and re-uploading it would be pure waste.
 */
const VOLATILE_ENTRIES = new Set(['meta.json', 'thumbnail.png'])

function buildEnvelope(
  format: StorageDocumentFormat,
  entries: [string, Uint8Array][]
): Uint8Array<ArrayBuffer> {
  const parts: Uint8Array[] = []
  const push = (bytes: Uint8Array): void => {
    parts.push(encodeLength(bytes.byteLength), bytes)
  }

  push(encodeText(`open-pencil/body/v${ENVELOPE_VERSION}`))
  // Distinct tags keep a `.fig` and a `.deck` with byte-identical content from
  // colliding — they are different documents and restore differently.
  push(encodeText(format))

  // Sorted: archive iteration order is not stable across writers, and the same
  // content in a different order is the same body.
  const sorted = [...entries].sort(([a], [b]) => {
    if (a < b) return -1
    return a > b ? 1 : 0
  })
  parts.push(encodeLength(sorted.length))
  for (const [path, bytes] of sorted) {
    push(encodeText(path))
    push(bytes)
  }

  return concatParts(parts)
}

/**
 * Body identity for a stored `.fig` / `.deck` archive.
 *
 * Stable across saves of unchanged content and across a save/open round trip;
 * different for any canvas or embedded-resource edit. Used on both the write
 * and the read path so an imported document identifies as what was exported.
 */
export async function computeBodyId(
  archiveBytes: Uint8Array,
  format: StorageDocumentFormat
): Promise<string> {
  const archive = unzipSync(archiveBytes, {
    filter: (file) => !VOLATILE_ENTRIES.has(file.name)
  })
  return hashEnvelope(buildEnvelope(format, Object.entries(archive)))
}

/**
 * Identity for content that is not (or not yet) an archive.
 *
 * A `.fig` written by an older build, or any body we cannot unzip, still needs
 * a stable id — falling back to "unknown" would make every save look changed.
 */
export async function computeOpaqueBodyId(
  bytes: Uint8Array,
  format: StorageDocumentFormat
): Promise<string> {
  return hashEnvelope(buildEnvelope(format, [['<opaque>', bytes]]))
}

/** Body identity, falling back to opaque bytes when the archive cannot be read. */
export async function computeBodyIdSafe(
  bytes: Uint8Array,
  format: StorageDocumentFormat
): Promise<string> {
  try {
    return await computeBodyId(bytes, format)
  } catch {
    return computeOpaqueBodyId(bytes, format)
  }
}
