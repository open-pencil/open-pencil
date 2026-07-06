import { closeSync, openSync, readSync } from 'node:fs'

const LFS_POINTER_PREFIX = 'version https://git-lfs'
const LFS_POINTER_CHECK_LENGTH = 30

/**
 * Checks if a file is a Git LFS pointer (text) instead of actual binary content.
 * LFS pointer files start with `version https://git-lfs.github.com/spec/`.
 *
 * Only reads the first 30 bytes of the file — does not load the entire
 * (potentially multi-MB) fixture into memory.
 *
 * Use with `test.skipIf(isLfsPointer(path))` to skip tests that require
 * LFS-tracked binary fixtures when LFS objects are unavailable (e.g. fork
 * PR CI runners that cannot authenticate with the upstream LFS server).
 */
export function isLfsPointer(filePath: string): boolean {
  let fd: number | undefined
  try {
    fd = openSync(filePath, 'r')
    const buffer = Buffer.alloc(LFS_POINTER_CHECK_LENGTH)
    readSync(fd, buffer, 0, LFS_POINTER_CHECK_LENGTH, 0)
    return buffer.toString('utf-8').startsWith(LFS_POINTER_PREFIX)
  } catch {
    return false
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}
