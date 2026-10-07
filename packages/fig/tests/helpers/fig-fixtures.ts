import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
