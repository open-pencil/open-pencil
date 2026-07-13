import { existsSync, readFileSync } from 'node:fs'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { parseFigFile } from '#core/io/formats/fig/read'

const LFS_POINTER_PREFIX = 'version https://git-lfs'

/**
 * Read a `.fig` fixture as an ArrayBuffer, or `null` when it is absent OR an
 * un-fetched Git LFS pointer. `tests/fixtures/*.fig` are LFS-tracked, so on a
 * shallow/LFS-less checkout `existsSync` passes but the bytes are a tiny ASCII
 * pointer stub — parsing it would throw. Optional-local tests skip on `null`.
 */
export function readFigFixture(path: string): ArrayBuffer | null {
  if (!existsSync(path)) return null
  const bytes = readFileSync(path)
  if (
    bytes.length < 1024 &&
    bytes.toString('utf8', 0, LFS_POINTER_PREFIX.length) === LFS_POINTER_PREFIX
  ) {
    return null
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

/** Parse a `.fig` fixture into a SceneGraph, or `null` when unavailable (see readFigFixture). */
export async function loadFigFixture(path: string): Promise<SceneGraph | null> {
  const ab = readFigFixture(path)
  return ab ? parseFigFile(ab) : null
}
