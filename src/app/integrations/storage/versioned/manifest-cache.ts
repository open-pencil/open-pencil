import { versionManifestKey } from '../namespace'
import { getObject } from '../s3/client'
import type { S3CompatibleConfig } from '../s3/types'
import type { StorageDocumentMetadata } from '../types'
import { parseVersionManifest, type ParsedVersionManifest } from './manifest'

/** Manifests are immutable, so a listing in steady state reads only each document's head. */
const CACHE_LIMIT = 2000
const cache = new Map<string, ParsedVersionManifest>()

function cacheKey(config: S3CompatibleConfig, stateId: string): string {
  return `${config.endpoint}\u0000${config.bucket}\u0000${stateId}`
}

export async function readVersionManifest(
  config: S3CompatibleConfig,
  stateId: string,
  fallback: StorageDocumentMetadata
): Promise<ParsedVersionManifest | null> {
  const key = cacheKey(config, stateId)
  const cached = cache.get(key)
  if (cached) return cached
  const parsed = parseVersionManifest(
    await getObject(config, versionManifestKey(stateId)),
    fallback
  )
  if (!parsed) return null
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(key, parsed)
  return parsed
}

/** Record a manifest this device just wrote, so its own commits never read it back. */
export function rememberVersionManifest(
  config: S3CompatibleConfig,
  stateId: string,
  parsed: ParsedVersionManifest
): void {
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(cacheKey(config, stateId), parsed)
}

export function clearVersionManifestCache(): void {
  cache.clear()
}
