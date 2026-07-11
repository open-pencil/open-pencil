/** Fixed OpenPencil namespace inside a shared bucket. Never list outside this prefix. */
export const CLOUD_NAMESPACE = 'open_pencil_storage'

export const CLOUD_NAMESPACE_MARKER = `${CLOUD_NAMESPACE}/.openpencil-namespace`

export const CLOUD_CANVASES_PREFIX = `${CLOUD_NAMESPACE}/canvases/`

export function canvasFigKey(canvasId: string): string {
  return `${CLOUD_CANVASES_PREFIX}${canvasId}.fig`
}

export function canvasMetaKey(canvasId: string): string {
  return `${CLOUD_CANVASES_PREFIX}${canvasId}.meta.json`
}

export function canvasThumbKey(canvasId: string): string {
  return `${CLOUD_CANVASES_PREFIX}${canvasId}.thumb.jpg`
}

/** Parse canvas id from a namespaced object key, or null if not a canvas .fig. */
export function canvasIdFromFigKey(key: string): string | null {
  const prefix = CLOUD_CANVASES_PREFIX
  if (!key.startsWith(prefix) || !key.endsWith('.fig')) return null
  const id = key.slice(prefix.length, -'.fig'.length)
  if (!id || id.includes('/')) return null
  return id
}

export const NAMESPACE_MARKER_BODY = JSON.stringify({
  app: 'open-pencil',
  version: 1
})
