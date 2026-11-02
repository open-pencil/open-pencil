import type {
  CreateWorkspaceInvitationInput,
  CreatedWorkspaceInvitation,
  InvitationPreview,
  WorkspaceInvitation,
  WorkspaceMembers,
  WorkspaceRole,
  WorkspaceSummary
} from '#cloud/contract'
import { cloudInvitationURL } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import type { TransactionalEmailService } from '#cloud/server/email/types'
import {
  invitationMatchesActor,
  invitationTokenIsActive,
  recipientHint
} from '#cloud/server/sharing/continuation'
import { dateString } from '#cloud/server/sharing/contracts'
import { hashCapability } from '#cloud/server/sharing/crypto'
import { findWorkspace, type WorkspaceDatabase } from '#cloud/server/workspaces/repository'
import type { Kysely } from 'kysely'

import { randomHex } from '@open-pencil/scene-graph/random'

const INVITATION_SECRET_BYTES = 24
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60_000

/** The workspace does not exist, or the person is not a member of it. */
export class WorkspaceNotFoundError extends Error {
  constructor() {
    super('Workspace not found')
    this.name = 'WorkspaceNotFoundError'
  }
}

/** Only a workspace's administrators may do this. */
export class WorkspaceForbiddenError extends Error {
  constructor() {
    super('Workspace administrators only')
    this.name = 'WorkspaceForbiddenError'
  }
}

/** The change would leave a workspace with members but no administrator. */
export class WorkspaceLastAdminError extends Error {
  constructor() {
    super('A workspace needs an administrator')
    this.name = 'WorkspaceLastAdminError'
  }
}

/**
 * A workspace still holds documents: live ones, or deleted ones kept until cleanup removes their
 * files, which deleting the workspace now would leave behind in object storage.
 */
export class WorkspaceNotEmptyError extends Error {
  constructor(readonly reason: 'documents' | 'pending-cleanup') {
    super('Workspace still holds documents')
    this.name = 'WorkspaceNotEmptyError'
  }
}

/** The person invited already belongs to the workspace. */
export class WorkspaceAlreadyMemberError extends Error {
  constructor() {
    super('Already a member of this workspace')
    this.name = 'WorkspaceAlreadyMemberError'
  }
}

/** The invitation is unknown, used, withdrawn, expired, or meant for someone else. */
export class WorkspaceInvitationInvalidError extends Error {
  constructor() {
    super('Workspace invitation is not valid')
    this.name = 'WorkspaceInvitationInvalidError'
  }
}

export type WorkspaceMemberServiceOptions = {
  email?: TransactionalEmailService
  publicURL: string
}

function invitationContract(row: {
  id: string
  emailNormalized: string
  role: WorkspaceRole
  invitedBy: string
  inviterName: string | null
  invitedAt: Date | string
  expiresAt: Date | string
}): WorkspaceInvitation {
  return {
    id: row.id,
    email: row.emailNormalized,
    role: row.role,
    invitedBy: { id: row.invitedBy, name: row.inviterName },
    invitedAt: dateString(row.invitedAt) ?? '',
    expiresAt: dateString(row.expiresAt) ?? ''
  }
}

async function adminCount(database: WorkspaceDatabase, workspaceId: string): Promise<number> {
  const rows = await database
    .selectFrom('workspaceMember')
    .select('userId')
    .where('workspaceId', '=', workspaceId)
    .where('role', '=', 'admin')
    .forUpdate()
    .execute()
  return rows.length
}

/** A member's row, locked until the transaction ends so roles change one at a time. */
async function lockedMember(
  database: WorkspaceDatabase,
  workspaceId: string,
  memberId: string
): Promise<{ role: WorkspaceRole }> {
  const member = await database
    .selectFrom('workspaceMember')
    .select('role')
    .where('workspaceId', '=', workspaceId)
    .where('userId', '=', memberId)
    .forUpdate()
    .executeTakeFirst()
  if (!member) throw new WorkspaceNotFoundError()
  return member
}

/**
 * Who belongs to a workspace and who is invited to it. Administrators invite, change roles, and
 * remove people; anyone may leave. A workspace with members always keeps an administrator.
 */
export function createWorkspaceMemberService(
  database: Kysely<CloudDatabase>,
  options: WorkspaceMemberServiceOptions
) {
  async function membership(userId: string, workspaceId: string): Promise<WorkspaceSummary> {
    const workspace = await findWorkspace(database, userId, workspaceId)
    if (!workspace) throw new WorkspaceNotFoundError()
    return workspace
  }

  async function requireAdmin(userId: string, workspaceId: string): Promise<WorkspaceSummary> {
    const workspace = await membership(userId, workspaceId)
    if (workspace.role !== 'admin') throw new WorkspaceForbiddenError()
    return workspace
  }

  /** A workspace's members with their accounts; user ids are text in membership rows. */
  function memberUsers(workspaceId: string) {
    return database
      .selectFrom('workspaceMember')
      .innerJoin('user', (join) =>
        join.on((expression) =>
          expression(
            expression.cast(expression.ref('user.id'), 'text'),
            '=',
            expression.ref('workspaceMember.userId')
          )
        )
      )
      .where('workspaceMember.workspaceId', '=', workspaceId)
  }

  function acceptanceURL(invitationId: string, token: string): string {
    return cloudInvitationURL(options.publicURL, invitationId, token)
  }

  /** Invites someone by email; a newer invitation to the same address replaces the older. */
  async function invite(
    userId: string,
    workspaceId: string,
    input: CreateWorkspaceInvitationInput
  ): Promise<CreatedWorkspaceInvitation> {
    const workspace = await requireAdmin(userId, workspaceId)
    const existing = await memberUsers(workspaceId)
      .select('workspaceMember.userId')
      .where((expression) =>
        expression(expression.fn('lower', [expression.ref('user.email')]), '=', input.email)
      )
      .executeTakeFirst()
    if (existing) throw new WorkspaceAlreadyMemberError()
    const inviter = await database
      .selectFrom('user')
      .select('name')
      .where('id', '=', userId)
      .executeTakeFirst()
    const id = crypto.randomUUID()
    const token = randomHex(INVITATION_SECRET_BYTES)
    const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS)
    const url = acceptanceURL(id, token)
    const row = await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('workspaceInvitation')
        .set({ revokedAt: new Date() })
        .where('workspaceId', '=', workspaceId)
        .where('emailNormalized', '=', input.email)
        .where('acceptedAt', 'is', null)
        .where('revokedAt', 'is', null)
        .execute()
      const inserted = await transaction
        .insertInto('workspaceInvitation')
        .values({
          id,
          workspaceId,
          emailNormalized: input.email,
          role: input.role,
          tokenHash: hashCapability(token),
          invitedBy: userId,
          expiresAt,
          acceptedAt: null,
          revokedAt: null
        })
        .returning(['id', 'emailNormalized', 'role', 'invitedBy', 'invitedAt', 'expiresAt'])
        .executeTakeFirstOrThrow()
      await options.email?.enqueue(
        {
          idempotencyKey: `workspace-invitation/${id}`,
          kind: 'workspace-invitation',
          recipientEmail: input.email,
          payload: {
            inviterName: inviter?.name ?? 'An OpenPencil user',
            workspaceName: workspace.name,
            role: input.role,
            expiresAt: expiresAt.toISOString(),
            acceptanceURL: url
          }
        },
        transaction
      )
      return inserted
    })
    return {
      invitation: invitationContract({ ...row, inviterName: inviter?.name ?? null }),
      acceptanceURL: url
    }
  }

  return {
    async rename(userId: string, workspaceId: string, name: string): Promise<WorkspaceSummary> {
      await requireAdmin(userId, workspaceId)
      await database
        .updateTable('workspace')
        .set({ name, updatedAt: new Date() })
        .where('id', '=', workspaceId)
        .execute()
      return membership(userId, workspaceId)
    },

    async list(userId: string, workspaceId: string): Promise<WorkspaceMembers> {
      const workspace = await membership(userId, workspaceId)
      const members = await memberUsers(workspaceId)
        .select([
          'workspaceMember.userId',
          'workspaceMember.role',
          'workspaceMember.createdAt',
          'user.name',
          'user.email',
          'user.image'
        ])
        .orderBy('workspaceMember.createdAt')
        .execute()
      const invitations =
        workspace.role === 'admin'
          ? await database
              .selectFrom('workspaceInvitation')
              .leftJoin('user', (join) =>
                join.on((expression) =>
                  expression(
                    expression.cast(expression.ref('user.id'), 'text'),
                    '=',
                    expression.ref('workspaceInvitation.invitedBy')
                  )
                )
              )
              .select([
                'workspaceInvitation.id',
                'workspaceInvitation.emailNormalized',
                'workspaceInvitation.role',
                'workspaceInvitation.invitedAt',
                'workspaceInvitation.expiresAt',
                'workspaceInvitation.invitedBy',
                'user.name as inviterName'
              ])
              .where('workspaceInvitation.workspaceId', '=', workspaceId)
              .where('workspaceInvitation.acceptedAt', 'is', null)
              .where('workspaceInvitation.revokedAt', 'is', null)
              .where('workspaceInvitation.expiresAt', '>', new Date())
              .orderBy('workspaceInvitation.invitedAt')
              .execute()
          : []
      return {
        members: members.map((member) => ({
          userId: member.userId,
          name: member.name,
          email: member.email,
          image: member.image,
          role: member.role,
          joinedAt: dateString(member.createdAt) ?? ''
        })),
        invitations: invitations.map(invitationContract)
      }
    },

    invite,

    /** Sends a waiting invitation again with a new link; the old link stops working. */
    async resendInvitation(
      userId: string,
      workspaceId: string,
      invitationId: string
    ): Promise<CreatedWorkspaceInvitation> {
      await requireAdmin(userId, workspaceId)
      const invitation = await database
        .selectFrom('workspaceInvitation')
        .select(['emailNormalized', 'role'])
        .where('id', '=', invitationId)
        .where('workspaceId', '=', workspaceId)
        .where('acceptedAt', 'is', null)
        .where('revokedAt', 'is', null)
        .executeTakeFirst()
      if (!invitation) throw new WorkspaceNotFoundError()
      return invite(userId, workspaceId, {
        email: invitation.emailNormalized,
        role: invitation.role
      })
    },

    async revokeInvitation(
      userId: string,
      workspaceId: string,
      invitationId: string
    ): Promise<void> {
      await requireAdmin(userId, workspaceId)
      const result = await database
        .updateTable('workspaceInvitation')
        .set({ revokedAt: new Date() })
        .where('id', '=', invitationId)
        .where('workspaceId', '=', workspaceId)
        .where('acceptedAt', 'is', null)
        .where('revokedAt', 'is', null)
        .executeTakeFirst()
      if (Number(result.numUpdatedRows) === 0) throw new WorkspaceNotFoundError()
    },

    async updateRole(
      userId: string,
      workspaceId: string,
      memberId: string,
      role: WorkspaceRole
    ): Promise<void> {
      await requireAdmin(userId, workspaceId)
      await database.transaction().execute(async (transaction) => {
        const member = await lockedMember(transaction, workspaceId, memberId)
        if (member.role === 'admin' && role !== 'admin') {
          if ((await adminCount(transaction, workspaceId)) <= 1) throw new WorkspaceLastAdminError()
        }
        await transaction
          .updateTable('workspaceMember')
          .set({ role })
          .where('workspaceId', '=', workspaceId)
          .where('userId', '=', memberId)
          .execute()
      })
    },

    /** Deletes an empty workspace, with its members and invitations. */
    async delete(userId: string, workspaceId: string): Promise<void> {
      await requireAdmin(userId, workspaceId)
      await database.transaction().execute(async (transaction) => {
        // Locked first, so a document created meanwhile waits and then finds no workspace.
        await transaction
          .selectFrom('workspace')
          .select('id')
          .where('id', '=', workspaceId)
          .forUpdate()
          .executeTakeFirstOrThrow()
        const documents = await transaction
          .selectFrom('document')
          .select(['deletedAt'])
          .where('workspaceId', '=', workspaceId)
          .execute()
        if (documents.some((document) => document.deletedAt === null)) {
          throw new WorkspaceNotEmptyError('documents')
        }
        if (documents.length > 0) throw new WorkspaceNotEmptyError('pending-cleanup')
        await transaction.deleteFrom('workspace').where('id', '=', workspaceId).execute()
      })
    },

    /** Removes a member, or lets someone leave; the last administrator cannot go. */
    async remove(userId: string, workspaceId: string, memberId: string): Promise<void> {
      if (memberId === userId) await membership(userId, workspaceId)
      else await requireAdmin(userId, workspaceId)
      await database.transaction().execute(async (transaction) => {
        const member = await lockedMember(transaction, workspaceId, memberId)
        if (member.role === 'admin' && (await adminCount(transaction, workspaceId)) <= 1) {
          throw new WorkspaceLastAdminError()
        }
        await transaction
          .deleteFrom('workspaceMember')
          .where('workspaceId', '=', workspaceId)
          .where('userId', '=', memberId)
          .execute()
      })
    },

    /** What a workspace invitation link offers, or null when the id is not one. */
    async preview(invitationId: string, token: string): Promise<InvitationPreview | null> {
      const invitation = await database
        .selectFrom('workspaceInvitation')
        .innerJoin('workspace', 'workspace.id', 'workspaceInvitation.workspaceId')
        .select([
          'workspaceInvitation.emailNormalized',
          'workspaceInvitation.role',
          'workspaceInvitation.tokenHash',
          'workspaceInvitation.expiresAt',
          'workspaceInvitation.acceptedAt',
          'workspaceInvitation.revokedAt',
          'workspaceInvitation.invitedBy',
          'workspace.name as workspaceName'
        ])
        .where('workspaceInvitation.id', '=', invitationId)
        .executeTakeFirst()
      if (!invitation) return null
      if (!invitationTokenIsActive(invitation, token)) throw new WorkspaceInvitationInvalidError()
      const inviter = await database
        .selectFrom('user')
        .select('name')
        .where('id', '=', invitation.invitedBy)
        .executeTakeFirst()
      return {
        kind: 'workspace',
        workspaceName: invitation.workspaceName,
        role: invitation.role,
        inviterName: inviter?.name ?? 'An OpenPencil user',
        expiresAt: dateString(invitation.expiresAt) ?? '',
        recipientHint: recipientHint(invitation.emailNormalized)
      }
    },

    /**
     * Joins the workspace an invitation names, or returns null when the id is not a workspace
     * invitation. Someone already in it keeps the role they have.
     */
    async accept(
      actor: CloudActor,
      invitationId: string,
      token: string
    ): Promise<{ workspaceId: string; role: WorkspaceRole } | null> {
      const invitation = await database
        .selectFrom('workspaceInvitation')
        .select([
          'workspaceId',
          'emailNormalized',
          'role',
          'tokenHash',
          'expiresAt',
          'acceptedAt',
          'revokedAt'
        ])
        .where('id', '=', invitationId)
        .executeTakeFirst()
      if (!invitation) return null
      if (
        !invitationMatchesActor(actor, invitation.emailNormalized) ||
        !invitationTokenIsActive(invitation, token)
      ) {
        throw new WorkspaceInvitationInvalidError()
      }
      return database.transaction().execute(async (transaction) => {
        await transaction
          .insertInto('workspaceMember')
          .values({
            workspaceId: invitation.workspaceId,
            userId: actor.userId,
            role: invitation.role
          })
          .onConflict((conflict) => conflict.columns(['workspaceId', 'userId']).doNothing())
          .execute()
        await transaction
          .updateTable('workspaceInvitation')
          .set({ acceptedAt: new Date() })
          .where('id', '=', invitationId)
          .where('acceptedAt', 'is', null)
          .execute()
        const member = await transaction
          .selectFrom('workspaceMember')
          .select('role')
          .where('workspaceId', '=', invitation.workspaceId)
          .where('userId', '=', actor.userId)
          .executeTakeFirstOrThrow()
        return { workspaceId: invitation.workspaceId, role: member.role }
      })
    }
  }
}

export type WorkspaceMemberService = ReturnType<typeof createWorkspaceMemberService>
