import * as v from 'valibot'

import { createCanvasJSXPreview } from '@/app/ai/preview/canvas'
import type { CollabRoomConnection } from '@/app/collab/room/connection'
import type { EditorStore } from '@/app/editor/active-store'
import { onAgentPreview, type AgentPreviewEvent } from '@/app/presence/preview-stream'

/** Bounds on what a peer can send, so a broken or hostile one cannot flood the preview. */
const MAX_ID_LENGTH = 64
/** A model streams arguments in small pieces; the controller also caps a call's whole input. */
export const MAX_PREVIEW_DELTA_LENGTH = 16_384

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_ID_LENGTH))
const AgentPreviewEventSchema = v.variant('type', [
  v.object({ type: v.literal('start'), agentId: id, callId: id, pageId: id }),
  v.object({
    type: v.literal('delta'),
    agentId: id,
    callId: id,
    text: v.pipe(v.string(), v.maxLength(MAX_PREVIEW_DELTA_LENGTH))
  }),
  v.object({ type: v.literal('finish'), agentId: id, callId: id }),
  v.object({ type: v.literal('clear'), agentId: id })
])
const AgentPreviewMessageSchema = v.pipe(v.string(), v.parseJson(), AgentPreviewEventSchema)

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function encodeAgentPreview(event: AgentPreviewEvent): Uint8Array {
  return encoder.encode(JSON.stringify(event))
}

/**
 * The messages that carry `event`. A model's chunk can exceed what peers accept, so a long
 * delta goes as several in order; JSON escapes a surrogate pair split between two of them.
 */
export function encodeAgentPreviewMessages(event: AgentPreviewEvent): Uint8Array[] {
  if (event.type !== 'delta' || event.text.length <= MAX_PREVIEW_DELTA_LENGTH) {
    return [encodeAgentPreview(event)]
  }
  const messages: Uint8Array[] = []
  for (let offset = 0; offset < event.text.length; offset += MAX_PREVIEW_DELTA_LENGTH) {
    const text = event.text.slice(offset, offset + MAX_PREVIEW_DELTA_LENGTH)
    messages.push(encodeAgentPreview({ ...event, text }))
  }
  return messages
}

/** The event a peer sent, or null when it is malformed or out of bounds. */
export function decodeAgentPreview(data: Uint8Array): AgentPreviewEvent | null {
  const result = v.safeParse(AgentPreviewMessageSchema, decoder.decode(data))
  return result.success ? result.output : null
}

/** What remote previews are drawn with: the same controller the local chat run uses. */
export interface RemotePreviewController {
  start(callId: string, signal?: AbortSignal): void
  delta(callId: string, text: string): void
  finish(callId: string): void
  clear(): void
}

/**
 * Routes peers' preview events into one controller. Calls are keyed by peer, agent, and call,
 * so two peers' agents never collide, and everything a peer started ends when it leaves.
 */
export function createRemotePreviewRouter(
  controller: RemotePreviewController,
  /** Set right before a call starts: the page its preview belongs to. */
  setPage: (pageId: string) => void
) {
  const calls = new Map<string, { peerId: string; agentId: string }>()
  const key = (peerId: string, agentId: string, callId: string) =>
    `${peerId}\u0000${agentId}\u0000${callId}`

  function end(callKey: string): void {
    if (!calls.delete(callKey)) return
    controller.finish(callKey)
  }

  function endWhere(match: (call: { peerId: string; agentId: string }) => boolean): void {
    for (const [callKey, call] of calls) if (match(call)) end(callKey)
  }

  return {
    receive(event: AgentPreviewEvent, peerId: string): void {
      if (event.type === 'clear') {
        endWhere((call) => call.peerId === peerId && call.agentId === event.agentId)
        return
      }
      const callKey = key(peerId, event.agentId, event.callId)
      if (event.type === 'start') {
        end(callKey)
        calls.set(callKey, { peerId, agentId: event.agentId })
        setPage(event.pageId)
        controller.start(callKey)
      } else if (event.type === 'delta') {
        // A peer that joined mid-call missed its start; it sees the next call instead.
        if (calls.has(callKey)) controller.delta(callKey, event.text)
      } else {
        end(callKey)
      }
    },
    peerLeft(peerId: string): void {
      endWhere((call) => call.peerId === peerId)
    },
    clear(): void {
      calls.clear()
      controller.clear()
    }
  }
}

/**
 * Show other people's agents building on this canvas as they stream, and send ours to them.
 * The canvas preview draws only while this document is on screen and the call's page exists.
 */
export function shareAgentPreviews(
  store: EditorStore,
  connection: Pick<CollabRoomConnection, 'agentPreview' | 'onPeerLeave'>,
  /** Draws remote previews; the canvas preview the chat run uses unless a test supplies one. */
  createController: (pageId: () => string) => RemotePreviewController = (pageId) =>
    createCanvasJSXPreview(store, pageId, { activeTabOnly: false })
): () => void {
  const [send, receive] = connection.agentPreview
  let page = store.state.currentPageId
  const router = createRemotePreviewRouter(
    createController(() => page),
    (pageId) => {
      page = pageId
    }
  )
  let disposed = false
  receive((data, peerId) => {
    if (disposed) return
    const event = decodeAgentPreview(data)
    if (event) router.receive(event, peerId)
  })
  const stopLocal = onAgentPreview(store, (event) => {
    for (const message of encodeAgentPreviewMessages(event)) send(message)
  })
  const stopLeave = connection.onPeerLeave((peerId) => router.peerLeft(peerId))
  return () => {
    disposed = true
    stopLocal()
    stopLeave()
    router.clear()
  }
}
