/** Fixed OpenPencil namespace inside a shared storage backend. */
export const STORAGE_NAMESPACE = 'open_pencil_storage'
export const STORAGE_NAMESPACE_MARKER = `${STORAGE_NAMESPACE}/.openpencil-namespace`
export const STORAGE_DOCUMENTS_PREFIX = `${STORAGE_NAMESPACE}/canvases/`
/** Versioned layout: immutable content-addressed bodies. */
export const STORAGE_BODIES_PREFIX = `${STORAGE_NAMESPACE}/bodies/`
/** Versioned layout: immutable version manifests, keyed by stateId. */
export const STORAGE_VERSIONS_PREFIX = `${STORAGE_NAMESPACE}/versions/`

export function documentFigKey(documentId: string): string {
  return `${STORAGE_DOCUMENTS_PREFIX}${documentId}.fig`
}

export function documentMetaKey(documentId: string): string {
  return `${STORAGE_DOCUMENTS_PREFIX}${documentId}.meta.json`
}

export function documentThumbnailKey(documentId: string): string {
  return `${STORAGE_DOCUMENTS_PREFIX}${documentId}.thumb.jpg`
}

export function documentIdFromFigKey(key: string): string | null {
  if (!key.startsWith(STORAGE_DOCUMENTS_PREFIX) || !key.endsWith('.fig')) return null
  const id = key.slice(STORAGE_DOCUMENTS_PREFIX.length, -'.fig'.length)
  if (!id || id.includes('/')) return null
  return id
}

/** Versioned layout: immutable body object for a content id. */
export function bodyKey(bodyId: string): string {
  return `${STORAGE_BODIES_PREFIX}${bodyId}.fig`
}

export function bodyIdFromKey(key: string): string | null {
  if (!key.startsWith(STORAGE_BODIES_PREFIX) || !key.endsWith('.fig')) return null
  const id = key.slice(STORAGE_BODIES_PREFIX.length, -'.fig'.length)
  if (!id || id.includes('/')) return null
  return id
}

/** Versioned layout: immutable manifest describing one committed state. */
export function versionManifestKey(stateId: string): string {
  return `${STORAGE_VERSIONS_PREFIX}${stateId}.json`
}

export function stateIdFromManifestKey(key: string): string | null {
  if (!key.startsWith(STORAGE_VERSIONS_PREFIX) || !key.endsWith('.json')) return null
  const id = key.slice(STORAGE_VERSIONS_PREFIX.length, -'.json'.length)
  if (!id || id.includes('/')) return null
  return id
}

/**
 * Versioned layout: the per-document commit point. Lives UNDER the documents
 * prefix so one listing of `canvases/` sees both layouts; `documentIdFromFigKey`
 * cannot match it (no `.fig` suffix), keeping legacy callers honest.
 */
export function documentHeadKey(documentId: string): string {
  return `${STORAGE_DOCUMENTS_PREFIX}${documentId}/head.json`
}

export function documentIdFromHeadKey(key: string): string | null {
  if (!key.startsWith(STORAGE_DOCUMENTS_PREFIX) || !key.endsWith('/head.json')) return null
  const id = key.slice(STORAGE_DOCUMENTS_PREFIX.length, -'/head.json'.length)
  if (!id || id.includes('/')) return null
  return id
}

export const NAMESPACE_MARKER_BODY = JSON.stringify({
  app: 'open-pencil',
  version: 1
})
