import {
  CloudAPIError,
  cloudTicketRelayJoin,
  createCloudAPIClient,
  discoverCloud,
  downloadCloudDocument,
  sharedCloudRoomImages,
  type CloudFetch
} from '@open-pencil/cloud/client'
import {
  cloudCommunityURL,
  cloudShareURL,
  parseCloudEmbedPath,
  type ResolveDocumentShareInput
} from '@open-pencil/cloud/contract'
import { openCollabRoom, type CollabRoom } from '@open-pencil/collab'
import type { Editor } from '@open-pencil/core'
import { readFigFile } from '@open-pencil/core/io/formats/fig'
import { nextShownFrame } from '@open-pencil/vue/shared/frame'

import { embedRoomEditor } from './editor'

/** What an embed shows: a document shared by link, or one of the community gallery's. */
export type EmbedSource =
  | { kind: 'share'; shareId: string; secret: string }
  | { kind: 'community'; documentId: string; versionId: string | null }

/** The document an embed's address names, or null for an address that names none. */
export function readEmbedSource(url: URL): EmbedSource | null {
  const path = parseCloudEmbedPath(url.pathname)
  if (path?.kind === 'share') {
    const secret = url.hash.slice(1)
    return secret ? { kind: 'share', shareId: path.id, secret } : null
  }
  if (path?.kind === 'community') {
    return { kind: 'community', documentId: path.id, versionId: url.searchParams.get('version') }
  }
  return null
}

/** The document is not shared with whoever has the link, or not without signing in. */
export class EmbedUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super('The embedded document is not available', options)
    this.name = 'EmbedUnavailableError'
  }
}

/** An embed's open document: its name, where the editor opens it, and its room while live. */
export type OpenedEmbed = {
  name: string
  /** The document's own link, which opens it in the editor in a tab of its own. */
  editorURL: string
  close(): void
}

/**
 * An embed never asks with the visitor's account: it shows what anyone with the link may see, so
 * the page around it learns nothing about who is looking and can make no request as them.
 */
const guestFetch: CloudFetch = (input, init) => fetch(input, { ...init, credentials: 'omit' })

const unavailableStatuses = new Set([401, 403, 404, 410])

async function unlessUnavailable<T>(request: Promise<T>): Promise<T> {
  try {
    return await request
  } catch (error) {
    if (error instanceof CloudAPIError && unavailableStatuses.has(error.status)) {
      throw new EmbedUnavailableError({ cause: error })
    }
    throw error
  }
}

/** Shows the graph in the editor, on its first page, fitted to the frame. */
async function show(editor: Editor, bytes: Uint8Array, name: string, signal: AbortSignal) {
  const graph = await readFigFile(
    new File([Uint8Array.from(bytes)], `${name}.fig`, { type: 'application/octet-stream' }),
    { populate: 'none', signal }
  )
  signal.throwIfAborted()
  const outgoing = editor.graph
  editor.replaceGraph(graph)
  editor.releaseGraphResources(outgoing)
  editor.state.documentName = name
  await editor.switchPage(graph.getPages()[0]?.id ?? graph.rootId, { signal })
  await nextShownFrame({ signal })
  editor.zoomToFit()
}

/**
 * Keeps a shared document live while the embed shows it: its room, as a guest with no presence,
 * so editors' changes arrive and nobody sees the embed in the room. `onRestart` hears the
 * document moving to a new room, as after a restore, which the embed opens again.
 */
async function joinShareRoom(
  editor: Editor,
  client: ReturnType<typeof createCloudAPIClient>,
  shareId: string,
  input: ResolveDocumentShareInput,
  onRestart: () => void
): Promise<CollabRoom | null> {
  const first = await client.getSharedCollaborationTicket(shareId, input)
  if (first.provider !== 'relay' || !first.serverURL) return null
  return openCollabRoom({
    roomId: first.roomId,
    editor: embedRoomEditor(editor),
    joinRoom: cloudTicketRelayJoin(
      first.serverURL,
      first,
      () => client.getSharedCollaborationTicket(shareId, input),
      { onRestored: onRestart }
    ),
    holdsDocument: true,
    images: {
      store: sharedCloudRoomImages({
        client,
        shareId,
        share: input,
        objectFetch: guestFetch
      }),
      owner: editor
    },
    commentsOnServer: true,
    presence: false
  })
}

/**
 * Opens the document an embed shows in its editor, from the server at `origin`: its latest
 * revision, or the community version asked for, and then, for a shared document, its room.
 */
export async function openEmbed(
  editor: Editor,
  source: EmbedSource,
  { origin, signal, onRestart }: { origin: string; signal: AbortSignal; onRestart: () => void }
): Promise<OpenedEmbed> {
  const discovery = await discoverCloud(origin, { fetch: guestFetch, signal })
  const client = createCloudAPIClient(discovery.apiURL, { fetch: guestFetch, signal })
  if (source.kind === 'community') {
    const { document } = await unlessUnavailable(
      client.getCommunityDocument(source.documentId, source.versionId)
    )
    const name = document.document.name
    await show(editor, await downloadCloudDocument(document, guestFetch, { signal }), name, signal)
    return {
      name,
      editorURL: cloudCommunityURL(origin, source.documentId, source.versionId),
      close: () => undefined
    }
  }
  const input: ResolveDocumentShareInput = { secret: source.secret }
  const { document } = await unlessUnavailable(client.getSharedDocument(source.shareId, input))
  const name = document.document.name
  await show(editor, await downloadCloudDocument(document, guestFetch, { signal }), name, signal)
  // Without its room the embed still shows the document as it was opened.
  const room = discovery.capabilities.collaboration
    ? await joinShareRoom(editor, client, source.shareId, input, onRestart).catch(
        (error: unknown) => {
          console.warn('[Embed] Joining the document’s room failed:', error)
          return null
        }
      )
    : null
  if (signal.aborted) room?.dispose()
  signal.throwIfAborted()
  return {
    name,
    editorURL: cloudShareURL(origin, source.shareId, source.secret),
    close: () => room?.dispose()
  }
}
