import type { Tab } from './index'

export function normalizeFilePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
}

function getLockKey(
  handle: FileSystemFileHandle | undefined,
  path: string | undefined,
  fileName: string
): string {
  if (path) return `path:${normalizeFilePath(path)}`
  if (handle) return `handle:${handle.name}`
  return `name:${fileName}`
}

export async function findExistingTab(
  tabs: readonly Tab[],
  handle: FileSystemFileHandle | undefined,
  path: string | undefined,
  fileName: string
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

  for (const tab of tabs) {
    const tabFileName = tab.store.getSourceFileName()
    if (tabFileName && tabFileName === fileName) {
      return tab
    }
  }

  return null
}

type LockEntry = {
  done: Promise<void>
  resolve: () => void
}

export function createFileOpenLock(getTabs: () => readonly Tab[]) {
  const inFlight = new Map<string, LockEntry>()

  return {
    run<T>(
      handle: FileSystemFileHandle | undefined,
      path: string | undefined,
      file: File,
      operation: (existingTab: Tab | null) => Promise<T>
    ): Promise<T> {
      const key = getLockKey(handle, path, file.name)
      const previous = inFlight.get(key)

      let resolveDone!: () => void
      const done = new Promise<void>((resolve) => {
        resolveDone = resolve
      })
      const entry: LockEntry = { done, resolve: resolveDone }

      // Register our entry before awaiting the previous one so any request that
      // starts while we wait serializes behind us rather than racing us.
      inFlight.set(key, entry)

      const execute = async (): Promise<T> => {
        if (previous) {
          await previous.done
        }
        const existingTab = await findExistingTab(getTabs(), handle, path, file.name)
        return operation(existingTab)
      }

      return execute().finally(() => {
        // Only remove the map entry if it still points to us; a later request
        // for the same key may have already replaced it.
        if (inFlight.get(key) === entry) {
          inFlight.delete(key)
        }
        resolveDone()
      })
    }
  }
}
