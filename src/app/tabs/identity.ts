import type { Tab } from './index'

type OptionalGlobal = {
  process?: { platform?: string }
  navigator?: { platform?: string }
}

const optionalGlobal = globalThis as OptionalGlobal

function isWindowsLike(): boolean {
  const nodePlatform = optionalGlobal.process?.platform
  if (nodePlatform) return nodePlatform === 'win32'
  return optionalGlobal.navigator?.platform?.startsWith('Win') ?? false
}

function isMacOSLike(): boolean {
  const nodePlatform = optionalGlobal.process?.platform
  if (nodePlatform) return nodePlatform === 'darwin'
  return optionalGlobal.navigator?.platform?.startsWith('Mac') ?? false
}

function isCaseInsensitiveFilesystem(): boolean {
  return isWindowsLike() || isMacOSLike()
}

/**
 * Normalize a file path for identity comparison.
 *
 * - On Windows-like platforms, backslash is a separator and a leading `\\`
 *   (UNC) prefix is preserved after slash conversion so `//server/share` is
 *   not collapsed to `/server/share`.
 * - On POSIX platforms, backslash is a legal filename character and is left
 *   untouched.
 * - Trailing slashes are removed on all platforms.
 * - On filesystems that are case-insensitive by default (Windows, macOS) the
 *   result is lowercased. Linux keeps the original casing.
 */
export function normalizeFilePath(path: string): string {
  let normalized: string

  if (isWindowsLike()) {
    const hasUnc = path.startsWith('\\\\')
    const body = hasUnc ? path.slice(2) : path
    normalized = body.replace(/\\/g, '/').replace(/\/+/g, '/')
    normalized = (hasUnc ? `//${normalized}` : normalized).replace(/\/$/, '')
  } else {
    normalized = path.replace(/\/+/g, '/').replace(/\/$/, '')
  }

  if (isCaseInsensitiveFilesystem()) {
    normalized = normalized.toLowerCase()
  }

  return normalized
}

/**
 * Search existing tabs for one that identifies as the same file as the
 * incoming open request.
 *
 * A stable identity requires either a canonical path or a
 * FileSystemFileHandle. When neither is provided we cannot prove that two
 * files are the same, so we deliberately return null and let the caller open
 * a new tab. File names alone are not identities.
 *
 * When a path is provided we only compare paths: the browser sandbox cannot
 * prove that a path and a handle refer to the same inode, so failing to
 * deduplicate (creating a duplicate tab) is safer than guessing.
 */
export async function findExistingTab(
  tabs: readonly Tab[],
  handle: FileSystemFileHandle | undefined,
  path: string | undefined
): Promise<Tab | null> {
  if (path) {
    const normalized = normalizeFilePath(path)
    for (const tab of tabs) {
      const tabPath = tab.store.getSourcePath() ?? tab.store.getFilePath()
      if (tabPath && normalizeFilePath(tabPath) === normalized) {
        return tab
      }
    }
    return null
  }

  if (handle) {
    for (const tab of tabs) {
      const tabHandle = tab.store.getSourceHandle() ?? tab.store.getFileHandle()
      if (!tabHandle) continue
      try {
        if (await handle.isSameEntry(tabHandle)) {
          return tab
        }
      } catch (error) {
        void error
        // Permission loss or other handle errors mean we cannot confirm they
        // are the same file; treat as different.
      }
    }
    return null
  }

  // No stable identity available. Opening a duplicate tab is the only safe
  // behavior because filename is not a file identity.
  return null
}

type LockEntry = {
  done: Promise<void>
  resolve: () => void
}

/**
 * Create a global serialization lock for file-open operations.
 *
 * The lock is intentionally global (one key) rather than keyed by file
 * identity. This guarantees:
 *   - The second open of the same file always observes the first tab's
 *     stored identity and switches instead of creating a duplicate.
 *   - The "reuse untouched tab" decision can never race between two
 *     concurrent opens of different files.
 *   - The active tab is captured after lock acquisition, so the file loads
 *     into the tab the user actually sees.
 *
 * `getTabs` is consulted when the operation callback runs so identity is
 * checked against the up-to-date tab list.
 */
export function createFileOpenLock(getTabs: () => readonly Tab[]) {
  const GLOBAL_KEY = 'global'
  const inFlight = new Map<string, LockEntry>()

  return {
    run<T>(
      handle: FileSystemFileHandle | undefined,
      path: string | undefined,
      operation: (existingTab: Tab | null) => Promise<T>
    ): Promise<T> {
      const previous = inFlight.get(GLOBAL_KEY)

      let resolveDone!: () => void
      const done = new Promise<void>((resolve) => {
        resolveDone = resolve
      })
      const entry: LockEntry = { done, resolve: resolveDone }

      // Register our entry before awaiting the previous one so any request that
      // starts while we wait chains behind us rather than racing us.
      inFlight.set(GLOBAL_KEY, entry)

      const execute = async (): Promise<T> => {
        if (previous) {
          await previous.done
        }
        const existingTab = await findExistingTab(getTabs(), handle, path)
        return operation(existingTab)
      }

      return execute().finally(() => {
        // Only remove the map entry if it still points to us; a later request
        // for the same key may have already replaced it.
        if (inFlight.get(GLOBAL_KEY) === entry) {
          inFlight.delete(GLOBAL_KEY)
        }
        resolveDone()
      })
    }
  }
}
