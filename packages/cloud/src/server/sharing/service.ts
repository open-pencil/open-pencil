import type {
  AcceptDocumentInvitationInput,
  CloudUserProfile,
  CreateInvitationContinuationInput,
  CreateDocumentInvitationInput,
  CreateDocumentShareInput,
  DocumentGrant,
  DocumentInvitation,
  DocumentPermission,
  DocumentShare,
  InvitationPreview,
  LookupCloudUserInput,
  PutDocumentGrantInput,
  ResolveDocumentShareInput,
  UpdateDocumentShareInput
} from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentForbiddenError, DocumentNotFoundError } from '#cloud/server/documents/service'
import type { InvitationDelivery } from '#cloud/server/invitations'
import type { Kysely, UpdateObject } from 'kysely'
import { sql } from 'kysely'
import { nanoid } from 'nanoid'

import { resolveDocumentAccess } from '../documents/access'

const SHARE_SECRET_SIZE = 32
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60_000

export class InvitationDeliveryError extends Error {
  override readonly name = 'InvitationDeliveryError'
}

export class DocumentShareInvalidError extends Error {
  override readonly name = 'DocumentShareInvalidError'
}

export type DocumentShareCapability = {
  share: DocumentShare
  secret: string
  path: string
}

export type ResolvedSharePrincipal =
  | { kind: 'user'; userId: string; name: string; email: string }
  | { kind: 'guest'; guestId: string; name: string }

export type ResolvedDocumentShare = {
  documentId: string
  permission: DocumentPermission
  principal: ResolvedSharePrincipal
  roomEpoch: number
}

function dateString(value: Date | string | null): string | null {
  if (value === null) return null
  return value instanceof Date ? value.toISOString() : value
}

function shareContract(row: {
  id: string
  documentId: string
  permission: DocumentPermission
  roomEpoch: number
  createdBy: string
  createdAt: Date | string
  updatedAt: Date | string
  expiresAt: Date | string | null
  revokedAt: Date | string | null
  lastUsedAt: Date | string | null
}): DocumentShare {
  return {
    ...row,
    createdAt: dateString(row.createdAt) ?? '',
    updatedAt: dateString(row.updatedAt) ?? '',
    expiresAt: dateString(row.expiresAt),
    revokedAt: dateString(row.revokedAt),
    lastUsedAt: dateString(row.lastUsedAt)
  }
}

function grantContract(row: {
  id: string
  documentId: string
  userId: string
  permission: DocumentPermission
  createdBy: string
  createdAt: Date | string
  updatedAt: Date | string
}): DocumentGrant {
  return {
    ...row,
    createdAt: dateString(row.createdAt) ?? '',
    updatedAt: dateString(row.updatedAt) ?? ''
  }
}

async function validInvitationToken(
  invitation: {
    tokenHash: string
    expiresAt: Date | string
    acceptedAt: Date | string | null
    revokedAt: Date | string | null
  },
  token: string
): Promise<boolean> {
  return (
    hashesEqual(invitation.tokenHash, await sha256(token)) &&
    !invitation.acceptedAt &&
    !invitation.revokedAt &&
    new Date(invitation.expiresAt).getTime() > Date.now()
  )
}

async function continuationKey(secret: string): Promise<CryptoKey> {
  const source = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'HKDF',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('openpencil-cloud-invitation-continuation'),
      info: new Uint8Array()
    },
    source,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function decodeBytes(value: string): Uint8Array {
  const padded = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

async function encryptContinuation(secret: string, token: string): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    await continuationKey(secret),
    new TextEncoder().encode(token)
  )
  return `${encodeBytes(nonce)}.${encodeBytes(new Uint8Array(encrypted))}`
}

async function decryptContinuation(secret: string, value: string): Promise<string> {
  const [nonce, encrypted] = value.split('.')
  if (!nonce || !encrypted) throw new DocumentShareInvalidError()
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBytes(nonce).slice() },
    await continuationKey(secret),
    decodeBytes(encrypted).slice()
  )
  return new TextDecoder().decode(decrypted)
}

function recipientHint(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`
}

function invitationContract(row: {
  id: string
  documentId: string
  emailNormalized: string
  permission: DocumentPermission
  invitedBy: string
  invitedAt: Date | string
  expiresAt: Date | string
  acceptedAt: Date | string | null
}): DocumentInvitation {
  return {
    id: row.id,
    documentId: row.documentId,
    email: row.emailNormalized,
    permission: row.permission,
    invitedBy: row.invitedBy,
    invitedAt: dateString(row.invitedAt) ?? '',
    expiresAt: dateString(row.expiresAt) ?? '',
    acceptedAt: dateString(row.acceptedAt)
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hashesEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

async function requireSharingAccess(
  database: Kysely<CloudDatabase>,
  userId: string,
  documentId: string
): Promise<void> {
  const access = await resolveDocumentAccess(database, userId, documentId)
  if (!access) throw new DocumentNotFoundError()
  if (!access.canManageSharing) throw new DocumentForbiddenError()
}

export type DocumentSharingServiceOptions = {
  continuationSecret?: string
  delivery?: InvitationDelivery
  publicURL?: string
  appURL?: string
}

export function createDocumentSharingService(
  database: Kysely<CloudDatabase>,
  options: DocumentSharingServiceOptions = {}
) {
  async function updateActiveShare(
    userId: string,
    documentId: string,
    shareId: string,
    changes: UpdateObject<CloudDatabase, 'documentShare'>
  ) {
    await requireSharingAccess(database, userId, documentId)
    const row = await database
      .updateTable('documentShare')
      .set(changes)
      .where('id', '=', shareId)
      .where('documentId', '=', documentId)
      .where('revokedAt', 'is', null)
      .returningAll()
      .executeTakeFirst()
    if (!row) throw new DocumentNotFoundError()
    return row
  }

  return {
    async lookupUser(
      userId: string,
      documentId: string,
      input: LookupCloudUserInput
    ): Promise<CloudUserProfile | null> {
      await requireSharingAccess(database, userId, documentId)
      const user = await database
        .selectFrom('user')
        .select(['id', 'name', 'email', 'image'])
        .where(sql<string>`lower(email)`, '=', input.email)
        .executeTakeFirst()
      return user ?? null
    },

    async userProfile(
      userId: string,
      documentId: string,
      profileUserId: string
    ): Promise<CloudUserProfile | null> {
      await requireSharingAccess(database, userId, documentId)
      return (
        (await database
          .selectFrom('user')
          .select(['id', 'name', 'email', 'image'])
          .where('id', '=', profileUserId)
          .executeTakeFirst()) ?? null
      )
    },

    async listShares(userId: string, documentId: string): Promise<DocumentShare[]> {
      await requireSharingAccess(database, userId, documentId)
      const rows = await database
        .selectFrom('documentShare')
        .selectAll()
        .where('documentId', '=', documentId)
        .where('revokedAt', 'is', null)
        .orderBy('createdAt', 'desc')
        .execute()
      return rows.map(shareContract)
    },

    async createShare(
      userId: string,
      documentId: string,
      input: CreateDocumentShareInput
    ): Promise<DocumentShareCapability> {
      await requireSharingAccess(database, userId, documentId)
      const id = crypto.randomUUID()
      const secret = nanoid(SHARE_SECRET_SIZE)
      const row = await database.transaction().execute(async (transaction) => {
        const document = await transaction
          .selectFrom('document')
          .select('collaborationEpoch')
          .where('id', '=', documentId)
          .forUpdate()
          .executeTakeFirstOrThrow()
        const created = await transaction
          .insertInto('documentShare')
          .values({
            id,
            documentId,
            permission: input.permission,
            secretHash: await sha256(secret),
            roomEpoch: document.collaborationEpoch,
            createdBy: userId,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            revokedAt: null,
            lastUsedAt: null
          })
          .returningAll()
          .executeTakeFirstOrThrow()
        return created
      })
      return { share: shareContract(row), secret, path: `/share/${id}#${secret}` }
    },

    async updateShare(
      userId: string,
      documentId: string,
      shareId: string,
      input: UpdateDocumentShareInput
    ): Promise<DocumentShare> {
      const row = await updateActiveShare(userId, documentId, shareId, {
        ...(input.permission ? { permission: input.permission } : {}),
        ...(input.expiresAt !== undefined
          ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
          : {}),
        updatedAt: new Date()
      })
      return shareContract(row)
    },

    async rotateShare(
      userId: string,
      documentId: string,
      shareId: string
    ): Promise<DocumentShareCapability> {
      const secret = nanoid(SHARE_SECRET_SIZE)
      const row = await database.transaction().execute(async (transaction) => {
        await requireSharingAccess(transaction, userId, documentId)
        const document = await transaction
          .updateTable('document')
          .set({ collaborationEpoch: (expression) => expression('collaborationEpoch', '+', 1) })
          .where('id', '=', documentId)
          .returning('collaborationEpoch')
          .executeTakeFirstOrThrow()
        const updated = await transaction
          .updateTable('documentShare')
          .set({
            secretHash: await sha256(secret),
            roomEpoch: document.collaborationEpoch,
            updatedAt: new Date()
          })
          .where('id', '=', shareId)
          .where('documentId', '=', documentId)
          .where('revokedAt', 'is', null)
          .returningAll()
          .executeTakeFirst()
        if (!updated) throw new DocumentNotFoundError()
        return updated
      })
      return { share: shareContract(row), secret, path: `/share/${shareId}#${secret}` }
    },

    async revokeShare(userId: string, documentId: string, shareId: string): Promise<void> {
      await database.transaction().execute(async (transaction) => {
        await requireSharingAccess(transaction, userId, documentId)
        const result = await transaction
          .updateTable('documentShare')
          .set({ revokedAt: new Date(), updatedAt: new Date() })
          .where('id', '=', shareId)
          .where('documentId', '=', documentId)
          .where('revokedAt', 'is', null)
          .executeTakeFirst()
        if (Number(result.numUpdatedRows) === 0) throw new DocumentNotFoundError()
        await transaction
          .updateTable('document')
          .set({ collaborationEpoch: (expression) => expression('collaborationEpoch', '+', 1) })
          .where('id', '=', documentId)
          .executeTakeFirst()
      })
    },

    async resolveShare(
      shareId: string,
      input: ResolveDocumentShareInput,
      actor?: CloudActor
    ): Promise<ResolvedDocumentShare> {
      const row = await database
        .selectFrom('documentShare')
        .innerJoin('document', 'document.id', 'documentShare.documentId')
        .select([
          'documentShare.id',
          'documentShare.documentId',
          'documentShare.permission',
          'documentShare.secretHash',
          'documentShare.roomEpoch',
          'documentShare.expiresAt'
        ])
        .where('documentShare.id', '=', shareId)
        .where('documentShare.revokedAt', 'is', null)
        .where('document.deletedAt', 'is', null)
        .executeTakeFirst()
      if (
        !row ||
        !hashesEqual(row.secretHash, await sha256(input.secret)) ||
        (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now())
      ) {
        throw new DocumentShareInvalidError()
      }
      await database
        .updateTable('documentShare')
        .set({ lastUsedAt: new Date() })
        .where('id', '=', shareId)
        .execute()
      const principal: ResolvedSharePrincipal = actor
        ? { kind: 'user', userId: actor.userId, name: actor.name, email: actor.email }
        : {
            kind: 'guest',
            guestId: input.guestId ?? nanoid(),
            name: input.guestName ?? 'Guest'
          }
      return {
        documentId: row.documentId,
        permission: row.permission,
        principal,
        roomEpoch: row.roomEpoch
      }
    },

    async listGrants(userId: string, documentId: string): Promise<DocumentGrant[]> {
      await requireSharingAccess(database, userId, documentId)
      const rows = await database
        .selectFrom('documentGrant')
        .select(['id', 'documentId', 'userId', 'permission', 'createdBy', 'createdAt', 'updatedAt'])
        .where('documentId', '=', documentId)
        .where('revokedAt', 'is', null)
        .orderBy('createdAt')
        .execute()
      return rows.map(grantContract)
    },

    async putGrant(
      userId: string,
      documentId: string,
      targetUserId: string,
      input: PutDocumentGrantInput
    ): Promise<DocumentGrant> {
      await requireSharingAccess(database, userId, documentId)
      const row = await database
        .insertInto('documentGrant')
        .values({
          id: crypto.randomUUID(),
          documentId,
          userId: targetUserId,
          permission: input.permission,
          createdBy: userId,
          revokedAt: null
        })
        .onConflict((conflict) =>
          conflict.columns(['documentId', 'userId']).doUpdateSet({
            permission: input.permission,
            createdBy: userId,
            revokedAt: null,
            updatedAt: new Date()
          })
        )
        .returning([
          'id',
          'documentId',
          'userId',
          'permission',
          'createdBy',
          'createdAt',
          'updatedAt'
        ])
        .executeTakeFirstOrThrow()
      return grantContract(row)
    },

    async revokeGrant(userId: string, documentId: string, targetUserId: string): Promise<void> {
      await requireSharingAccess(database, userId, documentId)
      const result = await database
        .updateTable('documentGrant')
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where('documentId', '=', documentId)
        .where('userId', '=', targetUserId)
        .where('revokedAt', 'is', null)
        .executeTakeFirst()
      if (Number(result.numUpdatedRows) === 0) throw new DocumentNotFoundError()
    },

    async listInvitations(userId: string, documentId: string): Promise<DocumentInvitation[]> {
      await requireSharingAccess(database, userId, documentId)
      const rows = await database
        .selectFrom('documentInvitation')
        .select([
          'id',
          'documentId',
          'emailNormalized',
          'permission',
          'invitedBy',
          'invitedAt',
          'expiresAt',
          'acceptedAt'
        ])
        .where('documentId', '=', documentId)
        .where('revokedAt', 'is', null)
        .orderBy('invitedAt')
        .execute()
      return rows.map(invitationContract)
    },

    async createInvitation(
      userId: string,
      documentId: string,
      input: CreateDocumentInvitationInput
    ): Promise<{ invitation: DocumentInvitation; token: string }> {
      await requireSharingAccess(database, userId, documentId)
      const id = crypto.randomUUID()
      const token = nanoid(SHARE_SECRET_SIZE)
      await database
        .insertInto('documentInvitation')
        .values({
          id,
          documentId,
          emailNormalized: input.email,
          permission: input.permission,
          tokenHash: await sha256(token),
          invitedBy: userId,
          expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS),
          acceptedAt: null,
          revokedAt: null
        })
        .execute()
      const row = await database
        .selectFrom('documentInvitation')
        .select([
          'id',
          'documentId',
          'emailNormalized',
          'permission',
          'invitedBy',
          'invitedAt',
          'expiresAt',
          'acceptedAt'
        ])
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
      const invitation = invitationContract(row)
      if (options.delivery && options.publicURL && options.appURL) {
        const [inviter, document] = await Promise.all([
          database.selectFrom('user').select('name').where('id', '=', userId).executeTakeFirst(),
          database
            .selectFrom('document')
            .select('name')
            .where('id', '=', documentId)
            .executeTakeFirstOrThrow()
        ])
        const acceptanceURL = new URL(
          `/cloud/invitations/${id}?server=${encodeURIComponent(options.publicURL)}#${token}`,
          options.appURL
        ).href
        try {
          await options.delivery.sendDocumentInvitation({
            deliveryId: id,
            recipientEmail: invitation.email,
            inviterName: inviter?.name ?? 'An OpenPencil user',
            documentName: document.name,
            permission: invitation.permission,
            expiresAt: invitation.expiresAt,
            acceptanceURL
          })
        } catch (error) {
          await database
            .updateTable('documentInvitation')
            .set({ revokedAt: new Date() })
            .where('id', '=', id)
            .execute()
          throw new InvitationDeliveryError('Invitation delivery failed', { cause: error })
        }
      }
      return { invitation, token }
    },

    async createInvitationContinuation(input: CreateInvitationContinuationInput) {
      if (!options.continuationSecret) throw new DocumentShareInvalidError()
      await this.previewInvitation(input.invitationId, { token: input.token })
      const id = nanoid()
      const expiresAt = new Date(Date.now() + 10 * 60_000)
      await database
        .insertInto('invitationContinuation')
        .values({
          id,
          invitationId: input.invitationId,
          tokenEncrypted: await encryptContinuation(options.continuationSecret, input.token),
          expiresAt,
          consumedAt: null
        })
        .execute()
      return { id }
    },

    async consumeInvitationContinuation(id: string): Promise<{
      invitationId: string
      token: string
    }> {
      if (!options.continuationSecret) throw new DocumentShareInvalidError()
      return database.transaction().execute(async (transaction) => {
        const row = await transaction
          .selectFrom('invitationContinuation')
          .select(['invitationId', 'tokenEncrypted', 'expiresAt', 'consumedAt'])
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst()
        if (row?.consumedAt || !row || new Date(row.expiresAt).getTime() <= Date.now()) {
          throw new DocumentShareInvalidError()
        }
        await transaction
          .updateTable('invitationContinuation')
          .set({ consumedAt: new Date() })
          .where('id', '=', id)
          .execute()
        return {
          invitationId: row.invitationId,
          token: await decryptContinuation(options.continuationSecret ?? '', row.tokenEncrypted)
        }
      })
    },

    async previewInvitation(
      invitationId: string,
      input: AcceptDocumentInvitationInput
    ): Promise<InvitationPreview> {
      const invitation = await database
        .selectFrom('documentInvitation')
        .innerJoin('document', 'document.id', 'documentInvitation.documentId')
        .select([
          'documentInvitation.emailNormalized',
          'documentInvitation.permission',
          'documentInvitation.tokenHash',
          'documentInvitation.expiresAt',
          'documentInvitation.acceptedAt',
          'documentInvitation.revokedAt',
          'documentInvitation.invitedBy',
          'document.name as documentName'
        ])
        .where('documentInvitation.id', '=', invitationId)
        .executeTakeFirst()
      if (!invitation || !(await validInvitationToken(invitation, input.token))) {
        throw new DocumentShareInvalidError()
      }
      const inviter = await database
        .selectFrom('user')
        .select('name')
        .where(sql<string>`id::text`, '=', invitation.invitedBy)
        .executeTakeFirst()
      return {
        documentName: invitation.documentName,
        inviterName: inviter?.name ?? 'An OpenPencil user',
        permission: invitation.permission,
        expiresAt: dateString(invitation.expiresAt) ?? '',
        recipientHint: recipientHint(invitation.emailNormalized)
      }
    },

    async acceptInvitation(
      actor: CloudActor,
      invitationId: string,
      input: AcceptDocumentInvitationInput
    ): Promise<DocumentGrant> {
      const invitation = await database
        .selectFrom('documentInvitation')
        .select([
          'id',
          'documentId',
          'emailNormalized',
          'permission',
          'tokenHash',
          'expiresAt',
          'acceptedAt',
          'revokedAt'
        ])
        .where('id', '=', invitationId)
        .executeTakeFirst()
      if (
        !invitation ||
        invitation.emailNormalized !== actor.email.trim().toLowerCase() ||
        !(await validInvitationToken(invitation, input.token))
      ) {
        throw new DocumentShareInvalidError()
      }
      return database.transaction().execute(async (transaction) => {
        const row = await transaction
          .insertInto('documentGrant')
          .values({
            id: crypto.randomUUID(),
            documentId: invitation.documentId,
            userId: actor.userId,
            permission: invitation.permission,
            createdBy: actor.userId,
            revokedAt: null
          })
          .onConflict((conflict) =>
            conflict.columns(['documentId', 'userId']).doUpdateSet({
              permission: invitation.permission,
              revokedAt: null,
              updatedAt: new Date()
            })
          )
          .returning([
            'id',
            'documentId',
            'userId',
            'permission',
            'createdBy',
            'createdAt',
            'updatedAt'
          ])
          .executeTakeFirstOrThrow()
        await transaction
          .updateTable('documentInvitation')
          .set({ acceptedAt: new Date() })
          .where('id', '=', invitationId)
          .where('acceptedAt', 'is', null)
          .execute()
        return grantContract(row)
      })
    },

    async revokeInvitation(
      userId: string,
      documentId: string,
      invitationId: string
    ): Promise<void> {
      await requireSharingAccess(database, userId, documentId)
      const result = await database
        .updateTable('documentInvitation')
        .set({ revokedAt: new Date() })
        .where('id', '=', invitationId)
        .where('documentId', '=', documentId)
        .where('revokedAt', 'is', null)
        .executeTakeFirst()
      if (Number(result.numUpdatedRows) === 0) throw new DocumentNotFoundError()
    }
  }
}

export type DocumentSharingService = ReturnType<typeof createDocumentSharingService>
