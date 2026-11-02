import { textOfSyncReply, textUpdate } from '#cloud-tests/helpers/relay'
import {
  COLLAB_ACTIONS,
  createRelayServerAssembler,
  decodeRelayServerFrame,
  defaultRelayURL,
  MAX_COLLAB_MESSAGE_BYTES,
  RELAY_CLOSE,
  RELAY_SERVER_PEER,
  relayClientMessages,
  type RelayClientFrame,
  type RelayServerFrame
} from '#cloud/contract'
import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import { createCollaborationTicketService, createDocumentSharingService } from '#cloud/server'
import * as Y from 'yjs'

// Checks a running Cloud Worker (see run.ts): the API, the editor, and the portal answer, and the relay's
// Durable Object admits ticket holders, keeps the room, and saves it to PostgreSQL.
const base = process.env.CLOUD_WORKER_URL ?? ''
const databaseURL = process.env.DATABASE_URL ?? ''
const authSecret = process.env.BETTER_AUTH_SECRET ?? ''

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function until(condition: () => boolean | Promise<boolean>, message: string) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await condition()) return
    await Bun.sleep(50)
  }
  throw new Error(message)
}

type Peer = {
  frames: RelayServerFrame[]
  closed: { code: number; reason: string } | null
  send(frame: RelayClientFrame): void
  close(): void
}

async function join(url: string, token: string): Promise<Peer> {
  const socket = new WebSocket(url)
  socket.binaryType = 'arraybuffer'
  const assembler = createRelayServerAssembler(() => MAX_COLLAB_MESSAGE_BYTES)
  const peer: Peer = {
    frames: [],
    closed: null,
    send(frame) {
      for (const message of relayClientMessages(frame)) socket.send(message)
    },
    close: () => socket.close()
  }
  socket.addEventListener('message', (event) => {
    if (!(event.data instanceof ArrayBuffer)) return
    const assembled = assembler.push(new Uint8Array(event.data))
    const frame = assembled.type === 'frame' ? decodeRelayServerFrame(assembled.data) : null
    if (frame) peer.frames.push(frame)
  })
  socket.addEventListener('close', (event) => {
    peer.closed = { code: event.code, reason: event.reason }
  })
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true })
    socket.addEventListener('error', () => reject(new Error(`Could not open ${url}`)), {
      once: true
    })
  })
  peer.send({ type: 'auth', token })
  await until(
    () => peer.closed !== null || peer.frames.some((frame) => frame.type === 'welcome'),
    'The relay did not answer a ticket'
  )
  return peer
}

function messages(peer: Peer, namespace: string) {
  return peer.frames.flatMap((frame) =>
    frame.type === 'message' && frame.namespace === namespace ? [frame] : []
  )
}

/**
 * Asks the relay for the room until its reply holds the editor's edit. The edit and the request
 * travel on different sockets, so the first reply can come before the room has the edit.
 */
async function servedEdit(peer: Peer, failure: string) {
  const ask = () =>
    peer.send({
      type: 'message',
      namespace: COLLAB_ACTIONS.syncStep1,
      target: RELAY_SERVER_PEER,
      payload: Y.encodeStateVector(new Y.Doc())
    })
  const served = () =>
    messages(peer, COLLAB_ACTIONS.syncReply).find(
      (reply) => textOfSyncReply(reply.payload) === 'hello from Workers'
    )
  let asked = 1
  ask()
  await until(() => {
    if (served()) return true
    if (messages(peer, COLLAB_ACTIONS.syncReply).length >= asked) {
      asked++
      ask()
    }
    return false
  }, failure)
  check(served()?.from === RELAY_SERVER_PEER, 'The sync reply did not come from the relay')
}

async function seed(database: ReturnType<typeof createPostgresCloudDatabase>) {
  const workspaceId = crypto.randomUUID()
  const documentId = crypto.randomUUID()
  await database
    .insertInto('workspace')
    .values({
      id: workspaceId,
      name: 'Workers',
      slug: `workers-${workspaceId}`,
      createdBy: 'owner'
    })
    .execute()
  await database
    .insertInto('workspaceMember')
    .values([
      { workspaceId, userId: 'owner', role: 'admin' },
      { workspaceId, userId: 'viewer', role: 'viewer' }
    ])
    .execute()
  await database
    .insertInto('document')
    .values({ id: documentId, workspaceId, name: 'Relay', createdBy: 'owner' })
    .execute()
  return documentId
}

for (const path of ['/health', '/ready', '/.well-known/openpencil']) {
  const response = await fetch(`${base}${path}`)
  check(response.ok, `${path} answered HTTP ${response.status}`)
}
for (const [path, title] of [
  ['/auth/sign-in', 'OpenPencil Cloud'],
  ['/', 'OpenPencil'],
  ['/documents/missing', 'OpenPencil']
]) {
  const page = await fetch(`${base}${path}`, { headers: { Accept: 'text/html' } })
  check(
    page.ok && (page.headers.get('content-type') ?? '').startsWith('text/html'),
    `The page at ${path} answered HTTP ${page.status}`
  )
  check(
    page.headers.get('content-security-policy') === "frame-ancestors 'none'",
    `The page at ${path} is missing its headers`
  )
  check((await page.text()).includes(`<title>${title}</title>`), `${path} is not the expected page`)
}
const missing = await fetch(`${base}/api/collaboration/relay`)
check(missing.status === 426, `A plain request to the relay answered HTTP ${missing.status}`)

const database = createPostgresCloudDatabase({ connectionString: databaseURL })
try {
  const tickets = createCollaborationTicketService({
    database,
    sharing: createDocumentSharingService(database),
    authSecret,
    relayURL: defaultRelayURL(base)
  })
  const user = (userId: string) => ({ userId, name: userId, email: `${userId}@example.com` })
  const documentId = await seed(database)
  const ticket = await tickets.issueUserTicket(user('owner'), documentId)
  const url = ticket.serverURL ?? ''

  const editor = await join(url, ticket.token)
  check(
    editor.closed === null,
    `The relay closed the editor: ${editor.closed?.code} ${editor.closed?.reason}`
  )
  editor.send({
    type: 'message',
    namespace: COLLAB_ACTIONS.yjsUpdate,
    target: null,
    payload: textUpdate('hello from Workers')
  })

  const viewer = await join(url, (await tickets.issueUserTicket(user('viewer'), documentId)).token)
  await servedEdit(viewer, 'The relay did not serve the edit to a newcomer')

  // Another document's ticket on this document's relay is refused.
  const other = await seed(database)
  const stranger = await join(url, (await tickets.issueUserTicket(user('owner'), other)).token)
  await until(() => stranger.closed !== null, 'The relay admitted another document’s ticket')
  check(
    stranger.closed?.code === RELAY_CLOSE.unauthorized,
    `Another document’s ticket closed with ${stranger.closed?.code}`
  )

  editor.close()
  viewer.close()
  await until(async () => {
    const saved = await database
      .selectFrom('documentCollaborationState')
      .select('state')
      .where('documentId', '=', documentId)
      .executeTakeFirst()
    return saved !== undefined
  }, 'The relay did not save the room')

  // Nobody is in the room now, so a newcomer gets it from what the relay saved.
  const returning = await join(
    url,
    (await tickets.issueUserTicket(user('viewer'), documentId)).token
  )
  await servedEdit(returning, 'The reopened room lost the edit')
  returning.close()

  const scheduled = await fetch(`${base}/__scheduled?cron=${encodeURIComponent('*/5 * * * *')}`)
  check(scheduled.ok, `The scheduled run answered HTTP ${scheduled.status}`)
  console.log('Cloud Worker checks passed')
} finally {
  await database.destroy()
}
