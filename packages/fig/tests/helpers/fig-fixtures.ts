import { writeFigArchive } from '#fig/archive'
import { deflateSync } from 'fflate'

import {
  createNodeChangesMessage,
  encodeMessage,
  getSchemaBytes,
  initCodec,
  type NodeChange
} from '@open-pencil/kiwi/fig/codec'

/** A `.fig` archive of `records`, as a file read from disk gives it. */
export async function figArchiveOf(records: NodeChange[]): Promise<ArrayBuffer> {
  await initCodec()
  const archive = writeFigArchive({
    schemaDeflated: deflateSync(getSchemaBytes()),
    kiwiData: encodeMessage(createNodeChangesMessage(0, 0, records)),
    thumbnailPNG: new Uint8Array(),
    metaJSON: '{}'
  })
  return new Uint8Array(archive).buffer
}
