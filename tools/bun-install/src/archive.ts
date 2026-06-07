import { cpSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { die } from './utils.ts'

/**
 * Returns the absolute path of a persistent, platform-appropriate directory
 * where pack output (.tgz tarballs) should be stored so that it outlives
 * this script's per-run temp directory.
 *
 * `bun add -g` records the absolute path of the tarball it installed from
 * in its global install metadata. If we leave the tarball in a per-run temp
 * dir, that recorded path becomes a dangling reference the moment we (or the
 * OS) clean up the temp dir. So we move it to a long-lived, conventional
 * location per platform:
 *
 *   - macOS:    ~/Library/Caches/<projectId>/install-command-archives
 *   - Linux:    ${XDG_CACHE_HOME:-~/.cache}/<projectId>/install-command-archives
 *   - Windows:  %LOCALAPPDATA%\<projectId>\Cache\install-command-archives
 *
 * The directory is NOT created here -- `moveIntoStore` will create it on
 * first use so we don't litter the user's filesystem with empty dirs.
 */
export function resolveArchiveStoreDir(projectId: string): string {
  const subdir = 'install-command-archives'

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA
    if (!localAppData) {
      die('LOCALAPPDATA is not set on Windows; cannot determine a persistent store directory.')
    }
    return join(localAppData, projectId, 'Cache', subdir)
  }

  if (process.platform === 'darwin') {
    const home = process.env.HOME ?? process.env.USERPROFILE
    if (!home) {
      die('Neither HOME nor USERPROFILE is set; cannot determine a persistent store directory.')
    }
    return join(home, 'Library', 'Caches', projectId, subdir)
  }

  // Linux and other Unix-likes: prefer XDG_CACHE_HOME, fall back to ~/.cache.
  const xdgCache = process.env.XDG_CACHE_HOME
  if (xdgCache) {
    return join(xdgCache, projectId, subdir)
  }
  const home = process.env.HOME ?? process.env.USERPROFILE
  if (!home) {
    die(
      'Neither HOME, USERPROFILE, nor XDG_CACHE_HOME is set; cannot determine a persistent store directory.'
    )
  }
  return join(home, '.cache', projectId, subdir)
}

/**
 * Derives a filesystem-safe project identifier from the workspace root's
 * `package.json` `name` field, with a fallback to the repo's basename.
 *
 * The result is constrained to `[a-zA-Z0-9._-]` (no separators, no NUL, no
 * leading dots/dashes/underscores) so it is safe to embed in a path on every
 * supported platform, including Windows (where `:` and `/` would break).
 */
export function deriveProjectId(repoRoot: string, rootPkgName: unknown): string {
  const sanitize = (raw: string): string | null => {
    const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^[._-]+/, '')
    return cleaned.length > 0 ? cleaned : null
  }

  if (typeof rootPkgName === 'string') {
    const fromPkg = sanitize(rootPkgName)
    if (fromPkg) return fromPkg
  }

  // Fallback: use the last path component of the repo root.
  const base = repoRoot.split(/[\\/]/).pop() ?? ''
  const fromDir = sanitize(base)
  if (fromDir) return fromDir

  return 'project'
}

/**
 * Atomically move a file to `destPath`, replacing any existing file there.
 *
 * The destination's parent directory is created if it does not exist.
 *
 * Atomicity contract:
 *
 *   - POSIX (macOS, Linux, *BSD, ...): `rename(2)` is atomic on the same
 *     filesystem. Any process that has the previous tarball open (e.g. a
 *     `bun` resolver still reading it, or another instance of this script
 *     racing) will see either the old contents or the new contents in their
 *     entirety -- never a partial or mixed state. This is exactly what we
 *     need to prevent consumers from picking up a half-written tarball
 *     when this script runs again.
 *
 *   - Windows: Node's `fs.rename` uses `MoveFileEx(MOVEFILE_REPLACE_EXISTING)`.
 *     If the destination is in use (ERROR_SHARING_VIOLATION -> EBUSY, or
 *     ERROR_ACCESS_DENIED -> EACCES/EPERM) the rename fails and we fall
 *     back to copy + remove. The fallback is NOT atomic -- there is a brief
 *     window during which the destination is being truncated and rewritten
 *     -- but it is the strongest guarantee available on that platform.
 *
 *   - Cross-device (EXDEV): rare on a single-user machine, but handled by
 *     a non-atomic copy + remove so the script still succeeds.
 */
export function moveIntoStore(srcPath: string, destPath: string): void {
  mkdirSync(dirname(destPath), { recursive: true })

  if (process.platform === 'win32') {
    // Best effort: try the atomic rename first; fall back to copy + remove
    // if the destination is open or otherwise unrenamable on Windows.
    try {
      renameSync(srcPath, destPath)
      return
    } catch {
      console.warn('Atomic rename failed on Windows, falling back to copy + remove')
    }
    cpSync(srcPath, destPath, { force: true })
    try {
      rmSync(srcPath, { force: true })
    } catch {
      console.warn('Could not remove source after cross-device copy; temp cleanup will sweep it')
    }
    return
  }

  // POSIX: rename(2) on the same filesystem is atomic. Same-filesystem
  // is overwhelmingly the common case here (both paths live under the
  // user's home/cache).
  try {
    renameSync(srcPath, destPath)
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'EXDEV') {
      // Cross-device link: not atomic, but at least it will succeed.
      cpSync(srcPath, destPath, { force: true })
      rmSync(srcPath, { force: true })
      return
    }
    throw err
  }
}
