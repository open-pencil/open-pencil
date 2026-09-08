import type { StorageDocumentBinding } from '@/app/integrations/storage/types'

export type LocalStorageIdentity =
  | {
      providerId: 'openpencil-cloud'
      connectionId: string
      workspaceId: string
      documentId: string
      canvasId: string
    }
  | {
      providerId: string
      documentId: string
      canvasId: string
    }

export function isCloudStorageBinding(
  binding: StorageDocumentBinding
): binding is Extract<StorageDocumentBinding, { providerId: 'openpencil-cloud' }> {
  return binding.providerId === 'openpencil-cloud'
}

export function storageCanvasId(input: {
  providerId: 'openpencil-cloud'
  documentId: string
  connectionId: string
}): string
export function storageCanvasId(input: { providerId: string; documentId: string }): string
export function storageCanvasId(input: {
  providerId: string
  documentId: string
  connectionId?: string
}): string {
  if (input.providerId === 'openpencil-cloud') {
    if (!input.connectionId) throw new Error('Cloud connection ID is required')
    return `${input.providerId}:${input.connectionId}:${input.documentId}`
  }
  return input.documentId
}

export function localStorageIdentity(binding: StorageDocumentBinding): LocalStorageIdentity {
  if (isCloudStorageBinding(binding)) {
    return {
      ...binding,
      canvasId: storageCanvasId(binding)
    }
  }
  return {
    providerId: binding.providerId,
    documentId: binding.documentId,
    canvasId: storageCanvasId(binding)
  }
}

export function remoteDocumentId(
  canvasId: string,
  metadata: { providerId: string; documentId?: string }
): string {
  if (metadata.providerId === 'openpencil-cloud' && !metadata.documentId) {
    throw new Error('Cloud document metadata is missing its remote document ID')
  }
  return metadata.documentId ?? canvasId
}

/** Random UUID without Math.random (project convention). */
export function createCanvasId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
