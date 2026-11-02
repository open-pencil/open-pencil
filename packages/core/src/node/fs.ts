import { chmod, lstat, open, realpath, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import { randomHex } from '@open-pencil/scene-graph/random'

export interface AtomicWriteOptions {
  /** The file's mode; an existing file otherwise keeps its own, and a new one gets the default. */
  mode?: number
  /**
   * What a symlink at `path` gets. `replace`, the default, puts the new file where the link was,
   * as a rename does, so a file kept under a root is never written outside it through a planted
   * link. `follow` writes the file the link points at, as a document saved in place should.
   */
  symlink?: 'follow' | 'replace'
}

function hasCode(error: unknown, ...codes: string[]): boolean {
  return error instanceof Error && 'code' in error && codes.includes(String(error.code))
}

async function resolveTarget(path: string): Promise<string> {
  try {
    return await realpath(path)
  } catch (error) {
    if (hasCode(error, 'ENOENT')) return path
    throw error
  }
}

/** The mode of the regular file at `path`, which a symlink or a missing file does not have. */
async function fileMode(path: string): Promise<number | undefined> {
  try {
    const stats = await lstat(path)
    return stats.isFile() ? stats.mode & 0o7777 : undefined
  } catch (error) {
    if (hasCode(error, 'ENOENT')) return undefined
    throw error
  }
}

/**
 * Writes `data` to `path` all at once: into a new file beside it, which then replaces it, so a
 * reader never sees half a file and a failed write leaves the old one. An existing file in a
 * directory that takes no new files is written in place, as it could be before.
 */
export async function writeFileAtomic(
  path: string,
  data: string | Uint8Array,
  options: AtomicWriteOptions = {}
): Promise<void> {
  const target = options.symlink === 'follow' ? await resolveTarget(path) : path
  const existing = await fileMode(target)
  const mode = options.mode ?? existing
  const temporary = join(dirname(target), `.${basename(target)}.${randomHex(8)}.tmp`)
  let handle
  try {
    handle = await open(temporary, 'wx', mode ?? 0o666)
  } catch (error) {
    if (existing === undefined || !hasCode(error, 'EACCES', 'EPERM')) throw error
    await writeFile(target, data)
    return
  }
  try {
    try {
      await handle.writeFile(data)
      // The mode `open` takes is masked by the umask; the file keeps the one it had.
      if (mode !== undefined) await chmod(temporary, mode)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporary, target)
  } catch (error) {
    await unlink(temporary).catch(() => undefined)
    throw error
  }
}
