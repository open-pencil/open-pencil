import type { DocumentPermission, WorkspaceRole } from '#cloud/contract'
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'

export type TimestampColumn = ColumnType<Date, Date | string | undefined, Date | string | null>

export type UploadStatus = 'pending' | 'cleaning' | 'committed' | 'abandoned'

export interface DocumentShareTable {
  id: string
  documentId: string
  permission: DocumentPermission
  secretHash: string
  roomEpoch: Generated<number>
  createdBy: string
  createdAt: TimestampColumn
  updatedAt: TimestampColumn
  expiresAt: TimestampColumn | null
  revokedAt: TimestampColumn | null
  lastUsedAt: TimestampColumn | null
}

export interface DocumentGrantTable {
  id: string
  documentId: string
  userId: string
  permission: DocumentPermission
  createdBy: string
  createdAt: TimestampColumn
  updatedAt: TimestampColumn
  revokedAt: TimestampColumn | null
}

export interface DocumentInvitationTable {
  id: string
  documentId: string
  emailNormalized: string
  permission: DocumentPermission
  tokenHash: string
  invitedBy: string
  invitedAt: TimestampColumn
  expiresAt: TimestampColumn
  acceptedAt: TimestampColumn | null
  revokedAt: TimestampColumn | null
}

export interface WorkspaceTable {
  id: string
  name: string
  slug: string
  createdBy: string
  createdAt: TimestampColumn
  updatedAt: TimestampColumn
}

export interface WorkspaceMemberTable {
  workspaceId: string
  userId: string
  role: WorkspaceRole
  createdAt: TimestampColumn
}

export interface DocumentTable {
  id: string
  workspaceId: string
  name: string
  currentRevisionId: string | null
  version: Generated<number>
  createdBy: string
  createdAt: TimestampColumn
  updatedAt: TimestampColumn
  deletedAt: TimestampColumn | null
  cleanupClaimId: Generated<string | null>
  cleanupClaimedAt: TimestampColumn | null
}

export interface StorageObjectTable {
  id: string
  objectKey: string
  checksum: string
  byteSize: number
  contentType: string
  createdAt: TimestampColumn
}

export interface DocumentRevisionTable {
  id: string
  documentId: string
  parentRevisionId: string | null
  storageObjectId: string
  createdBy: string
  createdAt: TimestampColumn
}

export interface UploadTable {
  id: string
  documentId: string
  baseRevisionId: string | null
  objectKey: string
  checksum: string
  byteSize: number
  contentType: string
  multipartUploadId: string | null
  status: UploadStatus
  cleanupClaimId: Generated<string | null>
  cleanupClaimedAt: TimestampColumn | null
  createdBy: string
  createdAt: TimestampColumn
  expiresAt: TimestampColumn
}

export interface CloudDatabase {
  workspace: WorkspaceTable
  workspaceMember: WorkspaceMemberTable
  document: DocumentTable
  storageObject: StorageObjectTable
  documentRevision: DocumentRevisionTable
  documentShare: DocumentShareTable
  documentGrant: DocumentGrantTable
  documentInvitation: DocumentInvitationTable
  upload: UploadTable
}

export type Workspace = Selectable<WorkspaceTable>
export type NewWorkspace = Insertable<WorkspaceTable>
export type WorkspaceUpdate = Updateable<WorkspaceTable>
export type Document = Selectable<DocumentTable>
export type NewDocument = Insertable<DocumentTable>
export type DocumentRevision = Selectable<DocumentRevisionTable>
export type NewDocumentRevision = Insertable<DocumentRevisionTable>
export type DocumentShare = Selectable<DocumentShareTable>
export type NewDocumentShare = Insertable<DocumentShareTable>
export type DocumentGrant = Selectable<DocumentGrantTable>
export type NewDocumentGrant = Insertable<DocumentGrantTable>
export type DocumentInvitation = Selectable<DocumentInvitationTable>
export type NewDocumentInvitation = Insertable<DocumentInvitationTable>
export type StorageObject = Selectable<StorageObjectTable>
export type NewStorageObject = Insertable<StorageObjectTable>
export type Upload = Selectable<UploadTable>
export type NewUpload = Insertable<UploadTable>
