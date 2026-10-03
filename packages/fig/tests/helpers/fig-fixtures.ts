import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Shared archives live outside the package; this is the only path that reaches them. */
export const FIXTURES = resolve(import.meta.dir, '../../../../tests/fixtures')

/** Read a shared JSON fixture as data; a module import would escape the package root. */
export function readFixtureJSON<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf8')) as T
}

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
