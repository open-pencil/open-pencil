import type { CloudAPIClient } from '#cloud/client/api'
import { cloudChecksum } from '#cloud/client/files/checksum'
import { downloadCloudImage } from '#cloud/client/files/download'
import { uploadCloudImages } from '#cloud/client/files/images'
import type { CloudObjectFetch } from '#cloud/client/files/objects'
import {
  isCloudChecksum,
  type DocumentImageLink,
  type ResolveDocumentShareInput
} from '#cloud/contract'
import { groupBy, limitAsync } from 'es-toolkit'

import type { RoomImageStore } from '@open-pencil/collab'

const IMAGE_LOAD_CONCURRENCY = 6

/**
 * The bytes of each reference, downloaded once per checksum however many names share it. A
 * reference that is no checksum, or an image whose download fails, is left out, so the others
 * still load.
 */
async function loadLinked(
  refs: readonly { name: string; ref: string }[],
  links: (checksums: string[]) => Promise<DocumentImageLink[]>,
  objectFetch: CloudObjectFetch
): Promise<ReadonlyMap<string, Uint8Array>> {
  const byChecksum = groupBy(
    refs.filter((ref) => isCloudChecksum(ref.ref)),
    (ref) => ref.ref
  )
  const checksums = Object.keys(byChecksum)
  const loaded = new Map<string, Uint8Array>()
  if (checksums.length === 0) return loaded
  const download = limitAsync(
    (link: DocumentImageLink) => downloadCloudImage(link, objectFetch),
    IMAGE_LOAD_CONCURRENCY
  )
  await Promise.allSettled(
    (await links(checksums)).map(async (link) => {
      const bytes = await download(link)
      for (const ref of byChecksum[link.checksum] ?? []) loaded.set(ref.name, bytes)
    })
  )
  return loaded
}

/**
 * A Cloud room's images, kept in the document's workspace under their SHA-256: an editor stores
 * what it adds, and everyone with access loads what the room names.
 */
export function cloudRoomImages({
  client,
  documentId,
  canStore,
  objectFetch
}: {
  client: Pick<CloudAPIClient, 'requestImageUploads' | 'commitImageUploads' | 'getImageLinks'>
  documentId: string
  canStore: boolean
  /** How image bytes reach the object store, which may be another origin than the server. */
  objectFetch: CloudObjectFetch
}): RoomImageStore {
  return {
    canStore,
    async store(images) {
      const named = await Promise.all(
        images.map(async (image) => ({ ...image, checksum: await cloudChecksum(image.bytes) }))
      )
      await uploadCloudImages({
        cloud: client,
        documentId,
        images: named,
        objectFetch
      })
      return new Map(named.map((image) => [image.name, image.checksum]))
    },
    load: (refs) =>
      loadLinked(refs, (checksums) => client.getImageLinks(documentId, checksums), objectFetch)
  }
}

/** A guest's view of a shared Cloud room's images: it loads what the room names and stores none. */
export function sharedCloudRoomImages({
  client,
  shareId,
  share,
  objectFetch
}: {
  client: Pick<CloudAPIClient, 'getSharedImageLinks'>
  shareId: string
  share: ResolveDocumentShareInput
  objectFetch: CloudObjectFetch
}): RoomImageStore {
  return {
    canStore: false,
    store: async () => new Map(),
    load: (refs) =>
      loadLinked(
        refs,
        (checksums) => client.getSharedImageLinks(shareId, share, checksums),
        objectFetch
      )
  }
}
