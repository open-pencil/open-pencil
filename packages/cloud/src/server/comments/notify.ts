import { cloudCommentURL, type CommentEmailSetting, type CommentPerson } from '#cloud/contract'
import { userIdText, type CloudDatabase } from '#cloud/server/db'
import { lockForTransaction } from '#cloud/server/db/expressions'
import { resolveDocumentCommentAccess } from '#cloud/server/documents/access'
import type { TransactionalEmailService } from '#cloud/server/email'
import { uniq } from 'es-toolkit'
import type { Kysely, Transaction } from 'kysely'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toString } from 'mdast-util-to-string'

/**
 * How many comment emails one person's comments may send in a day, and how many one account may
 * receive. A comment's words are the author's, so without a budget mentions are a way to send spam.
 */
export const COMMENT_EMAIL_BUDGET = {
  windowMs: 24 * 60 * 60 * 1000,
  perSender: 200,
  perRecipient: 50
} as const

/** What an account hears about when it chose nothing: comments that name it. */
export const DEFAULT_COMMENT_EMAILS: CommentEmailSetting = 'mentions'

const EXCERPT_LENGTH = 280

/**
 * The start of what a comment says, as plain text on one line: its Markdown read, so a mention
 * reads as `@Ana`, a link as its text, and each block apart from the next.
 */
export function commentExcerpt(body: string): string {
  const line = fromMarkdown(body)
    .children.map((block) => toString(block))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return line.length > EXCERPT_LENGTH ? `${line.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…` : line
}

type Source = Kysely<CloudDatabase> | Transaction<CloudDatabase>

/**
 * Everyone a document's comments may name: its workspace's members, the people it was shared with
 * directly, and its maker while they are in the workspace. Names only, never addresses.
 */
export async function commentPeople(source: Source, documentId: string): Promise<CommentPerson[]> {
  const document = await source
    .selectFrom('document')
    .select(['workspaceId'])
    .where('id', '=', documentId)
    .executeTakeFirst()
  if (!document) return []
  const members = source
    .selectFrom('workspaceMember')
    .select('workspaceMember.userId as userId')
    .where('workspaceMember.workspaceId', '=', document.workspaceId)
  const grantees = source
    .selectFrom('documentGrant')
    .select('documentGrant.userId as userId')
    .where('documentGrant.documentId', '=', documentId)
    .where('documentGrant.revokedAt', 'is', null)
  const ids = uniq(
    [...(await members.execute()), ...(await grantees.execute())].map((row) => row.userId)
  )
  if (ids.length === 0) return []
  const rows = await source
    .selectFrom('user')
    .select((expression) => [userIdText(expression).as('id'), 'user.name', 'user.image'])
    .where(userIdText, 'in', ids)
    .orderBy('user.name')
    .execute()
  return rows.map((row) => ({ id: row.id, name: row.name, image: row.image ?? null }))
}

/** The accounts of `ids` a comment by `authorId` may name: others who can read the document. */
async function readers(
  transaction: Transaction<CloudDatabase>,
  documentId: string,
  ids: readonly string[],
  authorId: string
): Promise<string[]> {
  const kept: string[] = []
  for (const id of uniq(ids)) {
    if (id === authorId) continue
    if (await resolveDocumentCommentAccess(transaction, id, documentId)) kept.push(id)
  }
  return kept
}

/**
 * Records whom a comment names, among those who may read it, and answers who is named now that
 * was not before, so an edit tells only the people it adds.
 */
export async function recordMentions(
  transaction: Transaction<CloudDatabase>,
  input: { documentId: string; commentId: string; authorId: string; mentions: readonly string[] }
): Promise<string[]> {
  const named = await readers(transaction, input.documentId, input.mentions, input.authorId)
  if (named.length === 0) return []
  const added = await transaction
    .insertInto('commentMention')
    .values(named.map((userId) => ({ commentId: input.commentId, userId })))
    .onConflict((conflict) => conflict.columns(['commentId', 'userId']).doNothing())
    .returning('userId')
    .execute()
  return added.map((row) => row.userId)
}

/** Counts an email against both daily budgets, or answers false once either is used. */
async function spendCommentEmail(
  transaction: Transaction<CloudDatabase>,
  senderId: string,
  recipientId: string,
  now: Date
): Promise<boolean> {
  // Always sender first, then recipient, so two transactions never wait on each other in turn.
  await lockForTransaction(transaction, `comment-email-sender:${senderId}`)
  await lockForTransaction(transaction, `comment-email-recipient:${recipientId}`)
  const since = new Date(now.getTime() - COMMENT_EMAIL_BUDGET.windowMs)
  // Both budgets in one read: what the sender's comments sent, and what the recipient received.
  const spent = await transaction
    .selectFrom('commentEmail')
    .select((expression) => [
      expression.fn.countAll<string>().filterWhere('senderId', '=', senderId).as('sent'),
      expression.fn.countAll<string>().filterWhere('recipientId', '=', recipientId).as('received')
    ])
    .where('sentAt', '>', since)
    .where((expression) =>
      expression.or([
        expression('senderId', '=', senderId),
        expression('recipientId', '=', recipientId)
      ])
    )
    .executeTakeFirstOrThrow()
  if (
    Number(spent.sent) >= COMMENT_EMAIL_BUDGET.perSender ||
    Number(spent.received) >= COMMENT_EMAIL_BUDGET.perRecipient
  ) {
    return false
  }
  await transaction
    .insertInto('commentEmail')
    .values({ id: crypto.randomUUID(), senderId, recipientId, sentAt: now })
    .execute()
  return true
}

/** Who else wrote in a thread and may still read it: whom a reply tells, as they chose. */
export async function threadParticipants(
  transaction: Transaction<CloudDatabase>,
  documentId: string,
  threadId: string,
  authorId: string
): Promise<string[]> {
  const rows = await transaction
    .selectFrom('comment')
    .select('authorId')
    .where('threadId', '=', threadId)
    .where('authorId', 'is not', null)
    .execute()
  return readers(
    transaction,
    documentId,
    rows.flatMap((row) => (row.authorId ? [row.authorId] : [])),
    authorId
  )
}

export type CommentNotifier = {
  email: TransactionalEmailService
  publicURL: string
}

/**
 * Emails the people a new comment concerns, in the transaction that writes it: those it names,
 * and, for a reply, the thread's other writers who asked to hear about every comment. Each hears
 * once, as their setting allows and while the day's budgets last.
 */
export async function notifyComment(
  transaction: Transaction<CloudDatabase>,
  notifier: CommentNotifier,
  comment: {
    id: string
    documentId: string
    threadId: string
    authorId: string
    body: string
    mentioned: readonly string[]
    participants: readonly string[]
  }
): Promise<void> {
  const recipients = [
    ...comment.mentioned.map((userId) => ({ userId, reason: 'mention' as const })),
    ...comment.participants
      .filter((userId) => !comment.mentioned.includes(userId))
      .map((userId) => ({ userId, reason: 'reply' as const }))
  ]
  if (recipients.length === 0) return
  const ids = recipients.map((recipient) => recipient.userId)
  const author = comment.authorId
  const [users, settings, document] = await Promise.all([
    transaction
      .selectFrom('user')
      .select((expression) => [userIdText(expression).as('id'), 'user.name', 'user.email'])
      .where(userIdText, 'in', [...ids, comment.authorId])
      .execute(),
    transaction
      .selectFrom('notificationSetting')
      .select(['userId', 'commentEmails'])
      .where('userId', 'in', ids)
      .execute(),
    transaction
      .selectFrom('document')
      .select('name')
      .where('id', '=', comment.documentId)
      .executeTakeFirstOrThrow()
  ])
  const byId = new Map(users.map((user) => [user.id, user]))
  const chosen = new Map(settings.map((setting) => [setting.userId, setting.commentEmails]))
  const now = new Date()
  for (const recipient of recipients) {
    const user = byId.get(recipient.userId)
    const setting = chosen.get(recipient.userId) ?? DEFAULT_COMMENT_EMAILS
    const wanted = setting === 'all' || (setting === 'mentions' && recipient.reason === 'mention')
    if (!user || !wanted) continue
    if (!(await spendCommentEmail(transaction, author, recipient.userId, now))) continue
    await notifier.email.enqueue(
      {
        idempotencyKey: `comment-notification/${comment.id}/${recipient.userId}`,
        kind: 'comment-notification',
        recipientEmail: user.email,
        payload: {
          name: user.name || null,
          authorName: byId.get(author)?.name || null,
          documentName: document.name,
          reason: recipient.reason,
          excerpt: commentExcerpt(comment.body),
          actionURL: cloudCommentURL(notifier.publicURL, comment.documentId, comment.threadId),
          settingsURL: new URL('/account/notifications', notifier.publicURL).href
        }
      },
      transaction
    )
  }
}

/** Which comments an account hears about by email. */
export async function readNotificationSettings(
  database: Kysely<CloudDatabase>,
  userId: string
): Promise<{ commentEmails: CommentEmailSetting }> {
  const row = await database
    .selectFrom('notificationSetting')
    .select('commentEmails')
    .where('userId', '=', userId)
    .executeTakeFirst()
  return { commentEmails: row?.commentEmails ?? DEFAULT_COMMENT_EMAILS }
}

export async function writeNotificationSettings(
  database: Kysely<CloudDatabase>,
  userId: string,
  settings: { commentEmails: CommentEmailSetting }
): Promise<{ commentEmails: CommentEmailSetting }> {
  await database
    .insertInto('notificationSetting')
    .values({ userId, commentEmails: settings.commentEmails, updatedAt: new Date() })
    .onConflict((conflict) =>
      conflict
        .column('userId')
        .doUpdateSet({ commentEmails: settings.commentEmails, updatedAt: new Date() })
    )
    .execute()
  return settings
}
