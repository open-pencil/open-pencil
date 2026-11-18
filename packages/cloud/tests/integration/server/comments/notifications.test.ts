import { afterEach, describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import type { CreateCommentThreadInput } from '#cloud/contract'
import {
  COMMENT_EMAIL_BUDGET,
  createCommentService,
  createTransactionalEmailService,
  decryptTransactionalEmailPayload
} from '#cloud/server'

const opened: { close(): Promise<void> }[] = []
afterEach(async () => {
  for (const runtime of opened.splice(0)) await runtime.close()
})
const SECRET = 'integration-test-secret-at-least-32-characters'

const pin: Omit<CreateCommentThreadInput, 'body' | 'mentions'> = {
  pageId: '0:1',
  pageName: 'Page 1',
  nodeId: null,
  nodeName: null,
  offsetX: null,
  offsetY: null,
  x: 0,
  y: 0
}

/** A workspace where Ana and Ben comment, Cy edits, and Dee is someone else entirely. */
async function seed() {
  const runtime = await createCloudTestDatabase()
  opened.push(runtime)
  const people = {
    ana: crypto.randomUUID(),
    ben: crypto.randomUUID(),
    cy: crypto.randomUUID(),
    dee: crypto.randomUUID()
  }
  await runtime.database
    .insertInto('user')
    .values(
      Object.entries(people).map(([name, id]) => ({
        id,
        name: name[0]?.toUpperCase() + name.slice(1),
        email: `${name}@example.com`,
        emailVerified: true,
        image: null
      }))
    )
    .execute()
  const workspaceId = crypto.randomUUID()
  const documentId = crypto.randomUUID()
  await runtime.database
    .insertInto('workspace')
    .values({
      id: workspaceId,
      name: 'Studio',
      slug: `studio-${workspaceId}`,
      createdBy: people.ana,
      ownerId: people.ana
    })
    .execute()
  await runtime.database
    .insertInto('workspaceMember')
    .values([
      { workspaceId, userId: people.ana, role: 'admin' },
      { workspaceId, userId: people.ben, role: 'viewer' },
      { workspaceId, userId: people.cy, role: 'editor' }
    ])
    .execute()
  await runtime.database
    .insertInto('document')
    .values({ id: documentId, workspaceId, name: 'Homepage', createdBy: people.ana })
    .execute()
  const email = createTransactionalEmailService(runtime.database, {
    encryptionSecret: SECRET,
    from: 'cloud@example.com'
  })
  const comments = createCommentService(runtime.database, {
    notifier: { email, publicURL: 'https://cloud.example.com' }
  })
  const as = (userId: string) => comments.forMember(userId, documentId)

  /** Who was emailed so far, and what each email said, oldest first. */
  async function emails() {
    const rows = await runtime.database
      .selectFrom('transactionalEmail')
      .select(['id', 'kind', 'recipientEmailNormalized', 'payloadEncrypted', 'createdAt'])
      .orderBy('createdAt')
      .orderBy('recipientEmailNormalized')
      .execute()
    return Promise.all(
      rows.map(async (row) => {
        const content = await decryptTransactionalEmailPayload(
          SECRET,
          row.id,
          row.kind,
          row.payloadEncrypted ?? ''
        )
        return { to: row.recipientEmailNormalized, ...content }
      })
    )
  }
  return { runtime, people, comments, as, emails, documentId }
}

describe('comment notifications', () => {
  test('email the people a comment names who can read it, as the account wrote it', async () => {
    const { comments, as, people, emails, documentId } = await seed()
    const thread = await comments.createThread(await as(people.ana), {
      ...pin,
      body: '@Ben @Dee can you check the heading?',
      mentions: [people.ben, people.dee, people.ana]
    })
    // Dee cannot open the document, and Ana wrote it.
    expect(thread.comments[0]?.mentions).toEqual([people.ben])
    const sent = await emails()
    expect(sent.map((email) => [email.to, email.kind])).toEqual([
      ['ben@example.com', 'comment-notification']
    ])
    expect(sent[0]?.payload).toMatchObject({
      name: 'Ben',
      authorName: 'Ana',
      documentName: 'Homepage',
      reason: 'mention',
      excerpt: '@Ben @Dee can you check the heading?',
      actionURL: `https://cloud.example.com/documents/${documentId}?comment=${thread.id}`
    })
  })

  test('tell a thread’s writers about replies only when they asked for everything', async () => {
    const { comments, as, people, emails } = await seed()
    const thread = await comments.createThread(await as(people.ben), { ...pin, body: 'Too tight' })
    await comments.reply(await as(people.cy), thread.id, { body: 'Agreed' })
    // Ben hears about comments that name him unless he chooses otherwise.
    expect(await emails()).toEqual([])

    await comments.setNotificationSettings(people.ben, { commentEmails: 'all' })
    await comments.setNotificationSettings(people.cy, { commentEmails: 'off' })
    await comments.reply(await as(people.ana), thread.id, {
      body: '@Cy fixed',
      mentions: [people.cy]
    })
    expect((await emails()).map((email) => [email.to, email.payload])).toEqual([
      ['ben@example.com', expect.objectContaining({ reason: 'reply', authorName: 'Ana' })]
    ])
  })

  test('tell an edit’s new names only, and keep to the day’s budget', async () => {
    const { runtime, comments, as, people, emails } = await seed()
    const ana = await as(people.ana)
    const thread = await comments.createThread(ana, {
      ...pin,
      body: '@Ben look',
      mentions: [people.ben]
    })
    const first = thread.comments[0]?.id ?? ''
    await comments.updateComment(ana, thread.id, first, {
      body: '@Ben @Cy look',
      mentions: [people.ben, people.cy]
    })
    expect((await emails()).map((email) => email.to)).toEqual(['ben@example.com', 'cy@example.com'])

    await runtime.database
      .insertInto('commentEmail')
      .values(
        Array.from({ length: COMMENT_EMAIL_BUDGET.perRecipient }, () => ({
          id: crypto.randomUUID(),
          senderId: people.cy,
          recipientId: people.ben
        }))
      )
      .execute()
    await comments.reply(ana, thread.id, { body: '@Ben again', mentions: [people.ben] })
    // Still named, so he sees it, though the day's emails to him are spent.
    expect((await emails()).map((email) => email.to)).toHaveLength(2)
  })

  test('mark a thread unread for everyone but who wrote in it, until they read it', async () => {
    const { comments, as, people } = await seed()
    const thread = await comments.createThread(await as(people.ana), { ...pin, body: 'Look' })
    const unread = async (userId: string) =>
      (await comments.list(await as(userId))).threads.map((listed) => listed.unread)
    expect(await unread(people.ana)).toEqual([false])
    expect(await unread(people.ben)).toEqual([true])

    await comments.markRead(await as(people.ben), thread.id)
    expect(await unread(people.ben)).toEqual([false])
    await comments.reply(await as(people.cy), thread.id, { body: 'On it' })
    expect(await unread(people.ben)).toEqual([true])
    expect(await unread(people.cy)).toEqual([false])
  })

  test('name the people a comment may mention, never their addresses', async () => {
    const { comments, as, people } = await seed()
    const { people: listed } = await comments.people(await as(people.ben))
    expect(listed).toEqual([
      { id: people.ana, name: 'Ana', image: null },
      { id: people.ben, name: 'Ben', image: null },
      { id: people.cy, name: 'Cy', image: null }
    ])
  })
})
