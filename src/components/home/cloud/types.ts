import type { DocumentKind } from '@open-pencil/scene-graph'

/** A place the home tab lists documents from. */
export type { HomeLocationView as HomeLocation } from '@/app/home/locations'

export type HomeCloudAccount = {
  id: string
  name: string
  email: string
  image?: string | null
  /** The Cloud server's host, such as `cloud.openpencil.dev`. */
  host: string
}

/** Where a Cloud document stands between this device and the server. */
export type CloudSyncState = 'synced' | 'uploading' | 'pending' | 'offline' | 'conflict' | 'error'

export type CloudDocumentRow = {
  id: string
  name: string
  /** A design or a board, when Cloud says which. */
  kind?: DocumentKind
  previewURL?: string | null
  editedAt: string
  editedBy?: string
  sync: CloudSyncState
  /** Shared beyond the workspace, with people or a link. */
  shared?: boolean
  permission: 'edit' | 'view'
}

/** A document in Trash as Home lists it. */
export type CloudTrashRow = {
  id: string
  name: string
  kind?: DocumentKind
  /** The workspace it was deleted from, when it was, and by whom. */
  metadata: string
  /** Whole days until it is deleted for good, at least 1 while it is still listed. */
  daysLeft: number
  /** The person may delete it for good now, not only restore it. */
  canPurge: boolean
}
