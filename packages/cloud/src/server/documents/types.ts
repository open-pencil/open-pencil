import type { ObjectUpload } from '#cloud/server/objects'

export type CreateDocumentRecord = {
  id: string
  workspaceId: string
  name: string
  kind: 'design' | 'board'
  createdBy: string
}

export type CreateDocumentUploadResult = {
  id: string
  upload: ObjectUpload
}
