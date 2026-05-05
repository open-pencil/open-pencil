import type { DownloadedFontCache } from '@open-pencil/core/text'

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

const CACHE_DIR = 'font-cache/v1'
const MANIFEST_PATH = `${CACHE_DIR}/manifest.json`
const EMPTY_MANIFEST: FontCacheManifest = { version: 1, entries: {} }

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

async function cacheKey(family: string, style: string) {
  return hashText(`${family}\0${style}`)
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
  const { BaseDirectory, readFile } = await import('@tauri-apps/plugin-fs')
  try {
    const data = await readFile(MANIFEST_PATH, { baseDir: BaseDirectory.AppLocalData })
    const parsed = JSON.parse(textDecoder.decode(data)) as Partial<FontCacheManifest>
    if (parsed.version !== 1 || !parsed.entries) return EMPTY_MANIFEST
    return { version: 1, entries: parsed.entries }
  } catch {
    return { version: 1, entries: {} }
  }
}

async function writeManifest(manifest: FontCacheManifest) {
  const { BaseDirectory, mkdir, writeFile } = await import('@tauri-apps/plugin-fs')
  await mkdir(CACHE_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true })
  await writeFile(MANIFEST_PATH, textEncoder.encode(JSON.stringify(manifest)), {
    baseDir: BaseDirectory.AppLocalData
  })
}

export function createTauriDownloadedFontCache(): DownloadedFontCache {
  return {
    async read(family, style) {
      const { BaseDirectory, readFile } = await import('@tauri-apps/plugin-fs')
      const manifest = await readManifest()
      const entry = manifest.entries[await cacheKey(family, style)]
      if (!entry) return null

      const data = await readFile(`${CACHE_DIR}/${entry.file}`, { baseDir: BaseDirectory.AppLocalData })
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      if (buffer.byteLength !== entry.byteLength) return null
      if ((await hashBytes(buffer)) !== entry.sha256) return null
      return buffer
    },

    async write(family, style, data) {
      const { BaseDirectory, mkdir, writeFile } = await import('@tauri-apps/plugin-fs')
      await mkdir(CACHE_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true })

      const key = await cacheKey(family, style)
      const sha256 = await hashBytes(data)
      const file = `${key}.ttf`
      await writeFile(`${CACHE_DIR}/${file}`, new Uint8Array(data), {
        baseDir: BaseDirectory.AppLocalData
      })

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
