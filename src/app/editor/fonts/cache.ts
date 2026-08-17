import type { DownloadedFontCache } from '@open-pencil/core/text'

import {
  readCacheBytes,
  readCacheJSON,
  removeCachePrefix,
  writeCacheBytes,
  writeCacheJSON
} from '@/app/cache'

type FontCacheEntry = {
  family: string
  style: string
  file: string
  byteLength: number
  sha256: string
  updatedAt: number
}

type FontCacheManifest = {
  version: 1
  entries: Partial<Record<string, FontCacheEntry>>
}

export interface DownloadedFontCacheSummary {
  count: number
  byteLength: number
  updatedAt: number | null
}

const CACHE_DIR = 'font-cache/v1'
const MANIFEST_PATH = `${CACHE_DIR}/manifest`
const FILE_DIR = `${CACHE_DIR}/files`
const EMPTY_MANIFEST: FontCacheManifest = { version: 1, entries: {} }
const textEncoder = new TextEncoder()

async function cacheKey(family: string, style: string, characters = '') {
  return hashText(`${family}\0${style}\0${Array.from(new Set(characters)).sort().join('')}`)
}

async function hashText(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value))
  return hexDigest(digest)
}

async function hashBytes(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return hexDigest(digest)
}

function hexDigest(data: ArrayBuffer) {
  return [...new Uint8Array(data)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function readManifest(): Promise<FontCacheManifest> {
  const manifest = await readCacheJSON<Partial<FontCacheManifest>>(MANIFEST_PATH)
  if (manifest?.version !== 1 || !manifest.entries) return EMPTY_MANIFEST
  return { version: 1, entries: manifest.entries }
}

async function writeManifest(manifest: FontCacheManifest) {
  await writeCacheJSON(MANIFEST_PATH, manifest)
}

export async function downloadedFontCacheSummary(): Promise<DownloadedFontCacheSummary> {
  const manifest = await readManifest()
  const entries = Object.values(manifest.entries).filter(
    (entry): entry is FontCacheEntry => !!entry
  )
  return {
    count: entries.length,
    byteLength: entries.reduce((sum, entry) => sum + entry.byteLength, 0),
    updatedAt: entries.length > 0 ? Math.max(...entries.map((entry) => entry.updatedAt)) : null
  }
}

export async function clearDownloadedFontCache(): Promise<void> {
  await removeCachePrefix(CACHE_DIR)
}

export function createTauriDownloadedFontCache(): DownloadedFontCache {
  return {
    async read(family, style, characters) {
      const manifest = await readManifest()
      const entry = manifest.entries[await cacheKey(family, style, characters)]
      if (!entry) return null

      const buffer = await readCacheBytes(`${FILE_DIR}/${entry.file}`)
      if (!buffer) return null
      if (buffer.byteLength !== entry.byteLength) return null
      if ((await hashBytes(buffer)) !== entry.sha256) return null
      return buffer
    },

    async write(family, style, data, characters) {
      const key = await cacheKey(family, style, characters)
      const sha256 = await hashBytes(data)
      const file = `${key}.ttf`
      await writeCacheBytes(`${FILE_DIR}/${file}`, data)

      const manifest = await readManifest()
      manifest.entries[key] = {
        family,
        style,
        file,
        byteLength: data.byteLength,
        sha256,
        updatedAt: Date.now()
      }
      await writeManifest(manifest)
    }
  }
}
