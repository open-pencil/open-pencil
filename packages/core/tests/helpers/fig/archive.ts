import { deflateSync } from 'fflate'

import { parseFigFile } from '@open-pencil/core/io/formats/fig'
import { type parseFigBuffer, writeFigArchive } from '@open-pencil/fig'
import { getCompiledSchema, getSchemaBytes } from '@open-pencil/kiwi/fig/codec'
import { expectDefined } from '@open-pencil/test-support/assert'

/** Opens saved bytes as the editor does: only the first page is read up front. */
export const open = (bytes: Uint8Array) =>
  parseFigFile(bytes.slice().buffer, { populate: 'first-page' })

/** A parsed archive written back as a .fig, after a test edited its records. */
export function encodeArchive(
  parsed: ReturnType<typeof parseFigBuffer>,
  images?: { name: string; data: Uint8Array }[]
): Uint8Array {
  const kiwi = getCompiledSchema().encodeMessage({
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    nodeChanges: parsed.nodeChanges
  })
  return writeFigArchive({
    schemaDeflated: deflateSync(getSchemaBytes()),
    kiwiData: kiwi,
    thumbnailPNG: expectDefined(parsed.thumbnailPNG, 'thumbnail'),
    metaJSON: parsed.metaJSON ?? '{}',
    ...(images ? { images } : {})
  })
}
