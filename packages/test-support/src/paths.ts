import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The workspace root, found by its lockfile rather than by counting directories. */
export function workspaceRoot(from = dirname(fileURLToPath(import.meta.url))): string {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'bun.lock'))) return dir
    if (dirname(dir) === dir) throw new Error(`No workspace root above ${from}`)
  }
}

const root = workspaceRoot()

/** A file in the repository, for assets that are not modules. */
export function repoPath(...segments: string[]): string {
  return join(root, ...segments)
}

/** The shared fixture corpus; a module import would escape the importing package's root. */
export const FIXTURES = repoPath('tests/fixtures')

export function readFixtureBytes(name: string): Uint8Array {
  return readFileSync(resolve(FIXTURES, name))
}

export function uint8ArrayToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = bytes.buffer
  if (buffer instanceof ArrayBuffer) {
    return buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }

  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

export function readFixtureArrayBuffer(name: string): ArrayBuffer {
  return uint8ArrayToArrayBuffer(readFixtureBytes(name))
}
