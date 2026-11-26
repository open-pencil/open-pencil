import { deflateSync, Inflate } from 'fflate'
import * as Y from 'yjs'

/**
 * The room messages collaboration sends. The relay reads the document ones to keep its copy,
 * persist it, and drop writes from viewers; it forwards the rest unread.
 */
export const COLLAB_ACTIONS = {
  yjsUpdate: 'yjs-update',
  syncStep1: 'sync-step1',
  syncReply: 'sync-reply',
  awareness: 'awareness',
  agentPreview: 'agent-preview',
  upload: 'upload',
  /** From the server only: the document's version history changed, so open lists load it again. */
  versions: 'versions',
  /** From the server only: a comment thread changed; the payload is its ID as UTF-8. */
  comments: 'comments'
} as const

/**
 * The most a room message may decode to, compressed or not. A peer's update past it is dropped
 * before it is decoded, so a small compressed reply cannot expand without bound.
 */
export const MAX_COLLAB_MESSAGE_BYTES = 256 * 1024 * 1024

/**
 * What a peer joining needs is the whole document, which repeats the same field names across
 * every layer, so the reply to its state vector travels compressed; Yjs's V2 encoding already
 * groups that repetition, and together they make a room's first sync about a twelfth the size.
 * Edits travel as V2 updates uncompressed: they are small, and arrive in a stream.
 */
export function encodeSyncReply(document: Y.Doc, stateVector: Uint8Array): Uint8Array {
  return deflateSync(Y.encodeStateAsUpdateV2(document, stateVector))
}

/**
 * Compressed input is inflated this much at a time, so a reply stops within a step of passing
 * the limit: deflate expands at most about 1,032 times, so a step can overshoot by about 16 MB.
 */
const INFLATE_STEP = 16 * 1024

/**
 * The V2 update a peer sent, inflated first when `compressed`, as a sync reply is; null once it
 * would decode past `limit` bytes. Throws on data that does not inflate.
 */
export function decodeRoomUpdate(
  data: Uint8Array,
  { limit, compressed = false }: { limit: number; compressed?: boolean }
): Uint8Array | null {
  if (!compressed) return data.length <= limit ? data : null
  const chunks: Uint8Array[] = []
  let size = 0
  const inflate = new Inflate((chunk) => {
    size += chunk.length
    if (size <= limit) chunks.push(chunk)
  })
  for (let offset = 0; offset < data.length; offset += INFLATE_STEP) {
    inflate.push(data.subarray(offset, offset + INFLATE_STEP), offset + INFLATE_STEP >= data.length)
    if (size > limit) return null
  }
  const inflated = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    inflated.set(chunk, at)
    at += chunk.length
  }
  return inflated
}

/** The peer ID the relay itself uses: it holds the room's document and answers sync requests. */
export const RELAY_SERVER_PEER = 'server'
