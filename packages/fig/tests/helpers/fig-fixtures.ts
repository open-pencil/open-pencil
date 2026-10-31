import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { writeFigArchive } from '#fig/archive'
import { deflateSync } from 'fflate'

import {
  createNodeChangesMessage,
  encodeMessage,
  getSchemaBytes,
  initCodec,
  type NodeChange
} from '@open-pencil/kiwi/fig/codec'

import { FIXTURES } from './paths'

export { FIXTURES }

export function readFixtureBytes(name: string): Uint8Array {
  return readFileSync(resolve(FIXTURES, name))
}

export function readFixtureArrayBuffer(name: string): ArrayBuffer {
  const bytes = readFixtureBytes(name)
  const buffer = bytes.buffer
  if (buffer instanceof ArrayBuffer) {
    return buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

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
