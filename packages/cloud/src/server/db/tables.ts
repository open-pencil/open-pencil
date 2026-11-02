import type { EnrollmentStatus } from '#cloud/admin/enrollment/service'
import type { CloudSignInMethod, DocumentPermission, WorkspaceRole } from '#cloud/contract'
import type { TransactionalEmailKind, TransactionalEmailPayloadByKind } from '#cloud/email'
import type { Account, Session } from 'better-auth'
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'

export type TimestampColumn = ColumnType<Date, Date | string | undefined, Date | string | null>

export type UploadStatus = 'pending' | 'finalizing' | 'cleaning' | 'committed' | 'abandoned'

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

export interface WorkspaceInvitationTable {
  id: string
  workspaceId: string
  emailNormalized: string
  role: WorkspaceRole
  tokenHash: string
  invitedBy: string
  invitedAt: TimestampColumn
  expiresAt: TimestampColumn
  acceptedAt: TimestampColumn | null
  revokedAt: TimestampColumn | null
}

export interface DocumentTable {
  id: string
  workspaceId: string
  name: string
  /** A design or a board; see migration 027. */
  kind: Generated<'design' | 'board'>
  currentRevisionId: string | null
  collaborationEpoch: Generated<number>
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

/** An image a workspace's documents use, stored once; see migration 023. */
export interface WorkspaceImageTable {
  workspaceId: string
  /** The SHA-256 of the bytes, which the object store verified. */
  checksum: string
  storageObjectId: string
  /** When a save last asked for it; an image no revision uses is released a while after. */
  touchedAt: TimestampColumn
}

/** An image a stored revision uses, under the name its file gives it. */
export interface RevisionImageTable {
  revisionId: string
  name: string
  workspaceId: string
  checksum: string
}

/** A revision kept in the document's history; see migration 021. */
export interface DocumentVersionTable {
  id: string
  documentId: string
  revisionId: string
  kind: 'checkpoint' | 'named'
  name: string | null
  description: string | null
  createdBy: string
  restoredFromVersionId: string | null
  createdAt: TimestampColumn
}

export type UploadKind = 'revision' | 'image'

export interface UploadTable {
  id: string
  /** An image upload names the document it was asked for, which decides who may make it. */
  documentId: string
  kind: Generated<UploadKind>
  baseRevisionId: string | null
  objectKey: string
  checksum: string
  byteSize: number
  contentType: string
  multipartUploadId: string | null
  status: UploadStatus
  finalizationStartedAt: TimestampColumn | null
  cleanupClaimId: Generated<string | null>
  cleanupClaimedAt: TimestampColumn | null
  createdBy: string
  createdAt: TimestampColumn
  expiresAt: TimestampColumn
}

export interface AuthUserTable {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: Generated<string | null>
  banned: Generated<boolean | null>
  banReason: Generated<string | null>
  banExpires: TimestampColumn | null
  /** Unset on accounts that never turned two-step sign-in on. */
  twoFactorEnabled: Generated<boolean | null>
  createdAt: TimestampColumn
  updatedAt: TimestampColumn
}

export interface TwoFactorTable {
  id: string
  secret: string
  backupCodes: string
  userId: string
  verified: Generated<boolean>
  failedVerificationCount: Generated<number>
  lockedUntil: TimestampColumn | null
}

export interface PasskeyTable {
  id: string
  name: string | null
  publicKey: string
  userId: string
  credentialID: string
  counter: number
  deviceType: string
  backedUp: boolean
  transports: string | null
  createdAt: TimestampColumn
  aaguid: string | null
}

export interface MFAAssuranceTable {
  sessionId: string
  userId: string
  method: 'totp' | 'recovery-code' | 'passkey'
  verifiedAt: TimestampColumn
}

export interface SignInTable {
  id: string
  userId: string
  sessionId: string | null
  method: CloudSignInMethod
  ipAddress: string | null
  userAgent: string | null
  createdAt: TimestampColumn
}

export type UserPictureFormat = 'png' | 'jpeg'

/** The picture an account shows: uploaded by its owner, or copied from a linked account. */
export interface UserPictureTable {
  userId: string
  bytes: Uint8Array
  format: UserPictureFormat
  /** The SHA-256 of the bytes, hex, which names this picture in its address. */
  checksum: string
  source: 'upload' | 'provider'
  createdAt: TimestampColumn
}

export interface DocumentCollaborationStateTable {
  documentId: string
  roomEpoch: number
  state: Uint8Array
  version: Generated<number>
  createdAt: TimestampColumn
  updatedAt: TimestampColumn
}

export interface InvitationContinuationTable {
  id: string
  invitationId: string
  tokenEncrypted: string
  expiresAt: TimestampColumn
  consumedAt: TimestampColumn | null
  createdAt: TimestampColumn
}

export interface WorkspaceEntitlementTable {
  workspaceId: string
  values: unknown
  source: string
  revision: Generated<number>
  /** Set only by versioned writes; see `setVersioned`. */
  externalVersion: number | null
  updatedAt: TimestampColumn
}

export interface WorkspaceStorageUsageTable {
  workspaceId: string
  committedBytes: number
  updatedAt: TimestampColumn
}

export interface UploadStorageReservationTable {
  id: string
  workspaceId: string
  uploadId: string
  bytes: number
  expiresAt: TimestampColumn
  committedAt: TimestampColumn | null
  releasedAt: TimestampColumn | null
  createdAt: TimestampColumn
}

export type TransactionalEmailStatus = 'pending' | 'sending' | 'accepted' | 'failed' | 'suppressed'

export interface TransactionalEmailTable {
  id: string
  idempotencyKey: string
  kind: TransactionalEmailKind
  recipientEmailNormalized: string
  payloadEncrypted: string | null
  status: TransactionalEmailStatus
  attemptCount: Generated<number>
  nextAttemptAt: TimestampColumn
  claimId: string | null
  claimedAt: TimestampColumn | null
  transport: string | null
  transportMessageId: string | null
  lastErrorCode: string | null
  createdAt: TimestampColumn
  updatedAt: TimestampColumn
  acceptedAt: TimestampColumn | null
}

export type TransactionalEmailPayload = TransactionalEmailPayloadByKind[TransactionalEmailKind]

export interface EnrollmentTable {
  id: string
  emailNormalized: string
  name: string | null
  reason: string | null
  status: EnrollmentStatus
  requestedAt: TimestampColumn
  reviewedAt: TimestampColumn | null
  reviewedBy: string | null
  reviewNote: string | null
  requestRevision: Generated<number>
  approvedUserId: string | null
}

export interface APIRateLimitTable {
  keyHash: string
  windowStartedAt: TimestampColumn
  requestCount: Generated<number>
  updatedAt: TimestampColumn
}

export interface AdminAuditEventTable {
  id: string
  actorUserId: string
  action: string
  subjectType: string
  subjectId: string
  metadata: unknown
  createdAt: TimestampColumn
}

export interface AuthSchemaVersionTable {
  id: string
  version: string
  updatedAt: TimestampColumn
}

export interface CloudDatabase {
  account: Account
  session: Session
  twoFactor: TwoFactorTable
  passkey: PasskeyTable
  mfaAssurance: MFAAssuranceTable
  signIn: SignInTable
  userPicture: UserPictureTable
  user: AuthUserTable
  authSchemaVersion: AuthSchemaVersionTable
  enrollment: EnrollmentTable
  apiRateLimit: APIRateLimitTable
  adminAuditEvent: AdminAuditEventTable
  workspace: WorkspaceTable
  workspaceMember: WorkspaceMemberTable
  workspaceInvitation: WorkspaceInvitationTable
  document: DocumentTable
  storageObject: StorageObjectTable
  documentRevision: DocumentRevisionTable
  revisionImage: RevisionImageTable
  workspaceImage: WorkspaceImageTable
  documentVersion: DocumentVersionTable
  documentShare: DocumentShareTable
  documentGrant: DocumentGrantTable
  documentInvitation: DocumentInvitationTable
  documentCollaborationState: DocumentCollaborationStateTable
  invitationContinuation: InvitationContinuationTable
  workspaceEntitlement: WorkspaceEntitlementTable
  workspaceStorageUsage: WorkspaceStorageUsageTable
  transactionalEmail: TransactionalEmailTable
  uploadStorageReservation: UploadStorageReservationTable
  upload: UploadTable
}

export type NewTransactionalEmail = Insertable<TransactionalEmailTable>
export type TransactionalEmail = Selectable<TransactionalEmailTable>
export type Workspace = Selectable<WorkspaceTable>
export type NewWorkspace = Insertable<WorkspaceTable>
export type WorkspaceUpdate = Updateable<WorkspaceTable>
export type Document = Selectable<DocumentTable>
export type NewDocument = Insertable<DocumentTable>
export type DocumentRevision = Selectable<DocumentRevisionTable>
export type DocumentVersion = Selectable<DocumentVersionTable>
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
