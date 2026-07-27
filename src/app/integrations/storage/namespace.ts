/** Fixed OpenPencil namespace inside a shared storage backend. */
export const STORAGE_NAMESPACE = 'open_pencil_storage'
export const STORAGE_NAMESPACE_MARKER = `${STORAGE_NAMESPACE}/.openpencil-namespace`
export const STORAGE_DOCUMENTS_PREFIX = `${STORAGE_NAMESPACE}/canvases/`

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

export const NAMESPACE_MARKER_BODY = JSON.stringify({
  app: 'open-pencil',
  version: 1
})
