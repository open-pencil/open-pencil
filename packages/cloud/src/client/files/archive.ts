import { CLOUD_IMAGE_NAME_PATTERN } from '#cloud/contract'

import {
  readStreamBytes,
  readZipDirectory,
  zipEntryContents,
  zipStream,
  type ZipEntry,
  type ZipStreamEntry
} from '@open-pencil/fig'

/** Where a `.fig` archive keeps its images, each under the name its paints refer to. */
const IMAGE_ENTRY_PREFIX = 'images/'

/** An image a `.fig` archive holds, as Cloud stores it apart from the file. */
export type CloudDocumentImage = { name: string; bytes: Uint8Array }

function archiveEntry(bytes: Uint8Array, entry: ZipEntry): ZipStreamEntry {
  return { name: entry.name, data: zipEntryContents(bytes, entry), deflate: entry.method !== 0 }
}

/**
 * The archive without its images, and the images, as views of `bytes`. A file that is not a zip
 * archive, or holds no images, comes back whole; an image under a name Cloud does not store
 * apart stays inside.
 */
export async function splitCloudDocument(
  bytes: Uint8Array
): Promise<{ lean: Uint8Array; images: CloudDocumentImage[] }> {
  const entries = readZipDirectory(bytes)
  if (!entries) return { lean: bytes, images: [] }
  const images: CloudDocumentImage[] = []
  const rest: ZipStreamEntry[] = []
  for (const entry of entries) {
    const name = entry.name.startsWith(IMAGE_ENTRY_PREFIX)
      ? entry.name.slice(IMAGE_ENTRY_PREFIX.length)
      : null
    // An empty image, or one under a name Cloud does not take, stays inside the file.
    if (name && CLOUD_IMAGE_NAME_PATTERN.test(name) && entry.size > 0) {
      images.push({ name, bytes: zipEntryContents(bytes, entry) })
    } else rest.push(archiveEntry(bytes, entry))
  }
  if (images.length === 0) return { lean: bytes, images }
  return { lean: await readStreamBytes(zipStream(rest)), images }
}

/** The archive with its images put back under their names; the lean archive when there are none. */
export async function assembleCloudDocument(
  lean: Uint8Array,
  images: CloudDocumentImage[]
): Promise<Uint8Array> {
  const entries = images.length === 0 ? null : readZipDirectory(lean)
  if (!entries) return lean
  return readStreamBytes(
    zipStream([
      ...entries.map((entry) => archiveEntry(lean, entry)),
      ...images.map((image) => ({ name: `${IMAGE_ENTRY_PREFIX}${image.name}`, data: image.bytes }))
    ])
  )
}
