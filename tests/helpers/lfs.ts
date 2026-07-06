import { readFileSync } from 'node:fs'

/**
 * Checks if a file is a Git LFS pointer (text) instead of actual binary content.
 * LFS pointer files start with `version https://git-lfs.github.com/spec/`.
 *
 * Use with `test.skipIf(isLfsPointer(path))` to skip tests that require
 * LFS-tracked binary fixtures when LFS objects are unavailable (e.g. fork
 * PR CI runners that cannot authenticate with the upstream LFS server).
 */
export function isLfsPointer(filePath: string): boolean {
  try {
    const buffer = readFileSync(filePath, { encoding: 'utf-8', flag: 'r' })
    return buffer.startsWith('version https://git-lfs')
  } catch {
    return false
  }
}
