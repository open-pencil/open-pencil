import { normalizeEnrollmentEmail } from '#cloud/admin/enrollment/service'
import type { CloudAccountDeletion } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { markPurged } from '#cloud/server/documents/purge'
import { handOverOwnership } from '#cloud/server/workspaces'
import { APIError } from 'better-auth'
import type { Kysely, Transaction } from 'kysely'

/** Workspaces the account alone administers while others belong to them, which it must hand on. */
export class AccountDeletionBlockedError extends Error {
  constructor(readonly workspaces: CloudAccountDeletion['blockedBy']) {
    super('The account is the only administrator of workspaces with other members')
    this.name = 'AccountDeletionBlockedError'
  }
}

/** The account is the deployment's last administrator, so deleting it would lock the console. */
export class AccountLastAdministratorError extends Error {
  constructor() {
    super('Cannot delete the last deployment administrator')
    this.name = 'AccountLastAdministratorError'
  }
}

/**
 * Whether the account is an administrator of the deployment with no other active one, the
 * check the console makes before banning or demoting one (`src/admin/users/service.ts`).
 * Inside a transaction it locks the administrators' rows, so two of them can't both go at once.
 */
async function lastAdministrator(
  database: Kysely<CloudDatabase> | Transaction<CloudDatabase>,
  userId: string,
  lock: boolean
): Promise<boolean> {
  let query = database
    .selectFrom('user')
    .select(['id', 'banned'])
    .where('role', '=', 'admin')
    .orderBy('id')
  if (lock) query = query.forUpdate()
  const administrators = await query.execute()
  if (!administrators.some((row) => row.id === userId)) return false
  return !administrators.some((row) => row.id !== userId && row.banned !== true)
}

type Membership = {
  workspaceId: string
  name: string
  role: string
  members: number
  admins: number
}

/** What happens to each workspace the account belongs to when it goes. */
function classify(memberships: Membership[]) {
  const deletes: Membership[] = []
  const blockedBy: Membership[] = []
  const leaves: Membership[] = []
  for (const membership of memberships) {
    if (membership.members === 1) deletes.push(membership)
    else if (membership.role === 'admin' && membership.admins === 1) blockedBy.push(membership)
    else leaves.push(membership)
  }
  return { deletes, blockedBy, leaves }
}

async function memberships(
  database: Kysely<CloudDatabase> | Transaction<CloudDatabase>,
  userId: string
): Promise<Membership[]> {
  return database
    .selectFrom('workspaceMember as own')
    .innerJoin('workspace', 'workspace.id', 'own.workspaceId')
    .innerJoin('workspaceMember as everyone', 'everyone.workspaceId', 'own.workspaceId')
    .select((expression) => [
      'own.workspaceId',
      'workspace.name',
      'own.role',
      expression.fn.count<number>('everyone.userId').as('members'),
      expression.fn
        .count<number>('everyone.userId')
        .filterWhere('everyone.role', '=', 'admin')
        .as('admins')
    ])
    .where('own.userId', '=', userId)
    .groupBy(['own.workspaceId', 'workspace.name', 'own.role'])
    .orderBy('workspace.name')
    .orderBy('own.workspaceId')
    .execute()
    .then((rows) =>
      rows.map((row) => ({ ...row, members: Number(row.members), admins: Number(row.admins) }))
    )
}

const workspaceSummary = (membership: Membership) => ({
  id: membership.workspaceId,
  name: membership.name
})

/**
 * Deleting an account: what it takes, and the Cloud side of taking it. Better Auth removes the
 * user with their sessions, sign-in methods, passkeys, and two-step secrets; this removes what
 * Cloud keeps about them. Workspaces only they belong to go with their documents, deleted
 * forever, which cleanup destroys once the deployment's grace passes; in workspaces others keep
 * they drop out, handing ownership, and so the plan the workspace draws on, to the
 * longest-standing other admin.
 */
export function createAccountDeletionService(database: Kysely<CloudDatabase>) {
  return {
    async plan(userId: string): Promise<CloudAccountDeletion> {
      const { deletes, blockedBy, leaves } = classify(await memberships(database, userId))
      const deleted = deletes.map((membership) => membership.workspaceId)
      const left = leaves.map((membership) => membership.workspaceId)
      const blocked = blockedBy.map((membership) => membership.workspaceId)
      // What the account can still download: everything in workspaces that go with it, and what
      // it created in workspaces it leaves, keeps an admin role in, or reaches only by a grant.
      const documents = await database
        .selectFrom('document')
        .innerJoin('workspace', 'workspace.id', 'document.workspaceId')
        .select(['document.id', 'document.name', 'workspace.name as workspaceName'])
        .where('document.deletedAt', 'is', null)
        .where('document.disabledAt', 'is', null)
        .where((expression) =>
          expression.or([
            ...(deleted.length > 0 ? [expression('document.workspaceId', 'in', deleted)] : []),
            expression.and([
              expression('document.createdBy', '=', userId),
              expression.or([
                ...(left.length > 0 ? [expression('document.workspaceId', 'in', left)] : []),
                ...(blocked.length > 0 ? [expression('document.workspaceId', 'in', blocked)] : []),
                expression(
                  'document.id',
                  'in',
                  expression
                    .selectFrom('documentGrant')
                    .select('documentGrant.documentId')
                    .where('documentGrant.userId', '=', userId)
                    .where('documentGrant.revokedAt', 'is', null)
                )
              ])
            ])
          ])
        )
        .orderBy('workspace.name')
        .orderBy('document.name')
        .orderBy('document.id')
        .execute()
      return {
        lastAdministrator: await lastAdministrator(database, userId, false),
        blockedBy: blockedBy.map(workspaceSummary),
        deletes: deletes.map(workspaceSummary),
        leaves: leaves.map(workspaceSummary),
        documents
      }
    },

    /**
     * Removes everything Cloud keeps about the account, in one transaction, or refuses with
     * `AccountDeletionBlockedError` and changes nothing. Its workspaces are locked first, so nobody
     * joins one, changes a role in one, or adds a document to one while it decides.
     */
    async remove(user: { id: string; email: string }): Promise<void> {
      await database.transaction().execute(async (transaction) => {
        if (await lastAdministrator(transaction, user.id, true)) {
          throw new AccountLastAdministratorError()
        }
        const workspaceIds = await transaction
          .selectFrom('workspaceMember')
          .select('workspaceId')
          .where('userId', '=', user.id)
          .orderBy('workspaceId')
          .execute()
        for (const { workspaceId } of workspaceIds) {
          await transaction
            .selectFrom('workspace')
            .select('id')
            .where('id', '=', workspaceId)
            .forUpdate()
            .execute()
        }
        const { deletes, blockedBy, leaves } = classify(await memberships(transaction, user.id))
        if (blockedBy.length > 0) {
          throw new AccountDeletionBlockedError(blockedBy.map(workspaceSummary))
        }
        const now = new Date()
        for (const { workspaceId } of deletes) {
          await transaction
            .updateTable('document')
            .set({ deletedAt: now })
            .where('workspaceId', '=', workspaceId)
            .where('deletedAt', 'is', null)
            .execute()
          // Nobody is left to restore them, so they are deleted forever, Trash included: out of
          // sight now, and destroyed by cleanup once the deployment's grace passes.
          const documents = await transaction
            .selectFrom('document')
            .select('id')
            .where('workspaceId', '=', workspaceId)
            .where('purgedAt', 'is', null)
            .execute()
          await markPurged(
            transaction,
            documents.map((document) => document.id),
            null,
            now
          )
          await transaction
            .updateTable('workspaceInvitation')
            .set({ revokedAt: now })
            .where('workspaceId', '=', workspaceId)
            .where('acceptedAt', 'is', null)
            .where('revokedAt', 'is', null)
            .execute()
          await transaction
            .deleteFrom('workspaceMember')
            .where('workspaceId', '=', workspaceId)
            .where('userId', '=', user.id)
            .execute()
          // One with documents stays, member-less, until cleanup purges the last of them.
          await transaction
            .deleteFrom('workspace')
            .where('id', '=', workspaceId)
            .where((expression) =>
              expression.not(
                expression.exists(
                  expression
                    .selectFrom('document')
                    .select('document.id')
                    .whereRef('document.workspaceId', '=', 'workspace.id')
                )
              )
            )
            .execute()
        }
        for (const { workspaceId } of leaves) {
          await transaction
            .deleteFrom('workspaceMember')
            .where('workspaceId', '=', workspaceId)
            .where('userId', '=', user.id)
            .execute()
          await handOverOwnership(transaction, workspaceId, user.id)
        }
        await transaction.deleteFrom('documentGrant').where('userId', '=', user.id).execute()
        for (const table of ['documentInvitation', 'workspaceInvitation'] as const) {
          await transaction
            .updateTable(table)
            .set({ revokedAt: now })
            .where('invitedBy', '=', user.id)
            .where('acceptedAt', 'is', null)
            .where('revokedAt', 'is', null)
            .execute()
        }
        await transaction.deleteFrom('invitationSend').where('senderId', '=', user.id).execute()
        for (const table of [
          'accountEntitlement',
          'termsAcceptance',
          'userPicture',
          'signIn',
          'mfaAssurance'
        ] as const) {
          await transaction.deleteFrom(table).where('userId', '=', user.id).execute()
        }
        // Personal access tokens have no key to cascade from, since Cloud builds their table.
        await transaction.deleteFrom('apikey').where('referenceId', '=', user.id).execute()
        await transaction
          .deleteFrom('enrollment')
          .where('emailNormalized', '=', normalizeEnrollmentEmail(user.email))
          .execute()
        // The user row goes in the same transaction, with the sessions, sign-in methods, passkeys
        // and two-step secrets its keys cascade to, so a failure leaves the account whole and
        // signed in to try again. Better Auth's own deletes that follow then find nothing.
        await transaction.deleteFrom('user').where('id', '=', user.id).execute()
      })
    }
  }
}

export type AccountDeletionService = ReturnType<typeof createAccountDeletionService>

/**
 * Better Auth's `user.deleteUser` options: it checks the password, or that the session is fresh,
 * then runs `beforeDelete` outside any transaction of its own, so Cloud's may query. That
 * transaction deletes the user too; a refusal reaches the client as `account_sole_admin` or
 * `last_admin_required`.
 */
export function accountDeletionOptions(database: Kysely<CloudDatabase>) {
  const deletion = createAccountDeletionService(database)
  return {
    enabled: true,
    async beforeDelete(user: { id: string; email: string }) {
      try {
        await deletion.remove(user)
      } catch (error) {
        if (error instanceof AccountDeletionBlockedError) {
          throw APIError.from('CONFLICT', { code: 'ACCOUNT_SOLE_ADMIN', message: error.message })
        }
        if (error instanceof AccountLastAdministratorError) {
          throw APIError.from('CONFLICT', { code: 'LAST_ADMIN_REQUIRED', message: error.message })
        }
        throw error
      }
    }
  }
}
