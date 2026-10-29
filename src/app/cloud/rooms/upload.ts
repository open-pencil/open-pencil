import * as v from 'valibot'

import { CloudAPIError } from '@open-pencil/cloud/client'

import type { CollabAction } from '@/app/collab/transport/types'
import type { EditorStore } from '@/app/editor/session'
import { followUpload, kickSyncEngine } from '@/app/storage/sync'

/** How long a tab waits for the room's saver to say the document is on its server. */
export const ROOM_UPLOAD_TIMEOUT_MS = 60_000

const idSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(64))
const uploadMessageSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.variant('type', [
    v.object({ type: v.literal('request'), id: idSchema }),
    v.object({ type: v.literal('reply'), id: idSchema, uploaded: v.boolean() })
  ])
)
type UploadMessage = v.InferOutput<typeof uploadMessageSchema>

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function encode(message: UploadMessage): Uint8Array {
  return encoder.encode(JSON.stringify(message))
}

/**
 * Saves what the tab of `store` has not saved yet, as Save does, and follows the document onto
 * the server, an earlier save still on its way included. Whether the document there is now what
 * the tab shows.
 */
export async function uploadStoredDocument(store: EditorStore): Promise<boolean> {
  const documentId = store.getStorageBinding()?.documentId
  if (!documentId) return false
  if (store.hasUnsavedChanges()) {
    await store.saveFigFile()
    await kickSyncEngine()
  }
  return (await followUpload(documentId)) === 'uploaded'
}

/**
 * What `request` gets from the document's server, asking once more after the document's upload
 * lands when the server does not know it yet, as a new document's tab asks before its first
 * upload has created it there. Aborting `signal` stops waiting for that upload.
 */
export async function onceOnServer<T>(
  documentId: string,
  request: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  try {
    return await request()
  } catch (error) {
    const unknown = error instanceof CloudAPIError && error.status === 404
    if (!unknown || (await followUpload(documentId, { signal })) !== 'uploaded') throw error
    return request()
  }
}

/**
 * Lets the tabs of a room get its document onto the server as it is now. The saver uploads when
 * asked; anyone else asks the saver, after the edits it sent, and the saver answers once the
 * upload is done, so the server holds everything that reached the saver before the question.
 * Only the saver's answer counts: another peer cannot say the upload finished.
 */
export function shareRoomUploads(
  [send, receive]: CollabAction,
  options: {
    /** Whether this tab saves the room's document. */
    saving: () => boolean
    /** The peer of the tab that saves for the room, when that is another tab. */
    saverPeer: () => string | null
    upload: () => Promise<boolean>
    timeoutMs?: number
  }
) {
  const { saving, saverPeer, upload, timeoutMs = ROOM_UPLOAD_TIMEOUT_MS } = options
  const waiting = new Map<string, { peer: string; answer: (uploaded: boolean) => void }>()

  receive((data, peerId) => {
    const parsed = v.safeParse(uploadMessageSchema, decoder.decode(data))
    if (!parsed.success) return
    const message = parsed.output
    if (message.type === 'reply') {
      const asked = waiting.get(message.id)
      if (asked?.peer === peerId) asked.answer(message.uploaded)
      return
    }
    // A tab that stopped saving since the question was asked says so rather than leave it waiting.
    if (!saving()) {
      send(encode({ type: 'reply', id: message.id, uploaded: false }), peerId)
      return
    }
    void upload()
      .catch(() => false)
      .then((uploaded) => send(encode({ type: 'reply', id: message.id, uploaded }), peerId))
  })

  function ask(): Promise<boolean> {
    const peer = saverPeer()
    if (!peer) return Promise.resolve(false)
    const request = crypto.randomUUID()
    const answer = new Promise<boolean>((resolve) => {
      waiting.set(request, { peer, answer: resolve })
    })
    const timer = setTimeout(() => waiting.get(request)?.answer(false), timeoutMs)
    // Edits made in this task reach the room in a microtask; the question has to follow them.
    queueMicrotask(() => send(encode({ type: 'request', id: request }), peer))
    return answer.finally(() => {
      clearTimeout(timer)
      waiting.delete(request)
    })
  }

  return {
    /** Whether the room's document is on the server with every edit this tab has seen. */
    upload: () => (saving() ? upload() : ask()),
    stop() {
      for (const { answer } of waiting.values()) answer(false)
    }
  }
}
