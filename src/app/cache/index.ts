import { IS_TAURI } from '@open-pencil/core/constants'

const APP_CACHE_DIR = 'cache/v1'
const STORAGE_PREFIX = 'open-pencil:cache:v1:'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function isTauriRuntime() {
  return IS_TAURI || ('window' in globalThis && '__TAURI_INTERNALS__' in window)
}

function isStorageAvailable(): boolean {
  // Runtime check — do NOT use module-level IS_BROWSER here because it is
  // evaluated once at import time.  In test environments other suites may
  // import this module before globalThis.window is installed, so IS_BROWSER
  // would be false even though localStorage is now available.
  // eslint-disable-next-line open-pencil/no-typeof-window-check — intentional runtime guard
  if (typeof window === 'undefined') return false
  try {
    return typeof window.localStorage.getItem === 'function'
  } catch {
    return false
  }
}

function cachePath(key: string) {
  return `${APP_CACHE_DIR}/${key.split('/').map(encodeURIComponent).join('/')}`
}

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`
}

export async function readCacheText(key: string): Promise<string | null> {
  if (isTauriRuntime()) {
    try {
      const { BaseDirectory, readFile } = await import('@tauri-apps/plugin-fs')
      return textDecoder.decode(
        await readFile(cachePath(key), { baseDir: BaseDirectory.AppLocalData })
      )
    } catch {
      return null
    }
  }

  if (!isStorageAvailable()) return null
  return window.localStorage.getItem(storageKey(key))
}

export async function writeCacheText(key: string, value: string): Promise<void> {
  if (isTauriRuntime()) {
    const { BaseDirectory, mkdir, writeFile } = await import('@tauri-apps/plugin-fs')
    await mkdir(APP_CACHE_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true })
    await writeFile(cachePath(key), textEncoder.encode(value), {
      baseDir: BaseDirectory.AppLocalData
    })
    return
  }

  if (!isStorageAvailable()) return
  window.localStorage.setItem(storageKey(key), value)
}

export async function removeCacheEntry(key: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      const { BaseDirectory, remove } = await import('@tauri-apps/plugin-fs')
      await remove(cachePath(key), { baseDir: BaseDirectory.AppLocalData })
    } catch (error) {
      console.warn(`Cache delete skipped for "${key}":`, error)
    }
    return
  }

  if (!isStorageAvailable()) return
  window.localStorage.removeItem(storageKey(key))
}

export async function readCacheBytes(key: string): Promise<ArrayBuffer | null> {
  if (!isTauriRuntime()) return null

  try {
    const { BaseDirectory, readFile } = await import('@tauri-apps/plugin-fs')
    const data = await readFile(cachePath(key), { baseDir: BaseDirectory.AppLocalData })
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  } catch {
    return null
  }
}

export async function writeCacheBytes(key: string, value: ArrayBuffer): Promise<void> {
  if (!isTauriRuntime()) return

  const { BaseDirectory, mkdir, writeFile } = await import('@tauri-apps/plugin-fs')
  await mkdir(APP_CACHE_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true })
  await writeFile(cachePath(key), new Uint8Array(value), { baseDir: BaseDirectory.AppLocalData })
}

export async function removeCachePrefix(prefix: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      const { BaseDirectory, remove } = await import('@tauri-apps/plugin-fs')
      await remove(cachePath(prefix), { baseDir: BaseDirectory.AppLocalData, recursive: true })
    } catch (error) {
      console.warn(`Cache prefix delete skipped for "${prefix}":`, error)
    }
    return
  }

  if (!isStorageAvailable()) return
  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const key = window.localStorage.key(i)
    if (key?.startsWith(storageKey(prefix))) window.localStorage.removeItem(key)
  }
}

type JsonCacheEnvelope<T> = {
  updatedAt: number
  value: T
}

export async function readCacheJson<T>(key: string, maxAgeMs?: number): Promise<T | null> {
  const raw = await readCacheText(key)
  if (!raw) return null

  try {
    const envelope = JSON.parse(raw) as Partial<JsonCacheEnvelope<T>>
    if (typeof envelope.updatedAt !== 'number' || !('value' in envelope)) return null
    if (maxAgeMs !== undefined && Date.now() - envelope.updatedAt > maxAgeMs) return null
    return envelope.value as T
  } catch {
    return null
  }
}

export async function writeCacheJson(key: string, value: unknown): Promise<void> {
  await writeCacheText(key, JSON.stringify({ updatedAt: Date.now(), value }))
}
