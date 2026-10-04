import * as v from 'valibot'

import { IS_TAURI } from '@open-pencil/core/constants'

const APP_CACHE_DIR = 'cache/v1'
const STORAGE_PREFIX = 'open-pencil:cache:v1:'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function isTauriRuntime() {
  return IS_TAURI || ('window' in globalThis && '__TAURI_INTERNALS__' in window)
}

function isStorageAvailable() {
  return 'window' in globalThis && !!window.localStorage
}

function cachePath(key: string) {
  return `${APP_CACHE_DIR}/${key.split('/').map(encodeURIComponent).join('/')}`
}

function cacheDirectoryPath(key: string) {
  const segments = key.split('/').slice(0, -1)
  return segments.length > 0
    ? `${APP_CACHE_DIR}/${segments.map(encodeURIComponent).join('/')}`
    : APP_CACHE_DIR
}

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`
}

function removeStorageEntriesWithPrefix(prefix: string): void {
  if (!isStorageAvailable()) return
  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const key = window.localStorage.key(i)
    if (key?.startsWith(storageKey(prefix))) window.localStorage.removeItem(key)
  }
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
    await mkdir(cacheDirectoryPath(key), { baseDir: BaseDirectory.AppLocalData, recursive: true })
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
  await mkdir(cacheDirectoryPath(key), { baseDir: BaseDirectory.AppLocalData, recursive: true })
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

  removeStorageEntriesWithPrefix(prefix)
}

const CacheEnvelopeJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ updatedAt: v.number(), value: v.unknown() })
)

/**
 * Read a JSON value written by `writeCacheJSON`. A missing, expired, malformed or
 * mismatched entry reads as null, so callers refetch instead of trusting stale shapes.
 */
export async function readCacheJSON<TSchema extends v.GenericSchema>(
  key: string,
  schema: TSchema,
  maxAgeMs?: number
): Promise<v.InferOutput<TSchema> | null> {
  const raw = await readCacheText(key)
  if (!raw) return null

  const envelope = v.safeParse(CacheEnvelopeJSON, raw)
  if (!envelope.success) return null
  if (maxAgeMs !== undefined && Date.now() - envelope.output.updatedAt > maxAgeMs) return null
  const value = v.safeParse(schema, envelope.output.value)
  return value.success ? value.output : null
}

export async function writeCacheJSON(key: string, value: unknown): Promise<void> {
  await writeCacheText(key, JSON.stringify({ updatedAt: Date.now(), value }))
}
