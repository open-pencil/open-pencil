import * as v from 'valibot'
// A page that frames the browser app can hand it a document and keep it: it names its own
// origin with `?embedder=<origin>`, posts the file in, hears when the document's edited state
// changes, and asks for the file back to store it. Only messages the parent frame sends from
// that exact origin are read, and every reply is posted to that origin alone.
import { watch } from 'vue'

import { errorMessage } from '@open-pencil/std/errors'

const MESSAGE_PREFIX = 'openpencil:'

const embedderRequestSchema = v.variant('type', [
  v.object({
    type: v.literal(`${MESSAGE_PREFIX}open`),
    name: v.pipe(v.string(), v.nonEmpty()),
    data: v.instance(ArrayBuffer)
  }),
  v.object({ type: v.literal(`${MESSAGE_PREFIX}save`), id: v.string() })
])

export type EmbedderRequest = v.InferOutput<typeof embedderRequestSchema>

export type EmbedderMessage =
  | { type: 'openpencil:ready' }
  | { type: 'openpencil:opened' }
  | { type: 'openpencil:edited'; edited: boolean }
  | { type: 'openpencil:saved'; id: string; data: ArrayBuffer }
  | { type: 'openpencil:failed'; id?: string; message: string }

/** The open document as the bridge sees it: its edited state, and a save that hands over the file. */
export interface EmbeddedDocument {
  hasUnsavedChanges: () => boolean
  saveFigFileCopy: (write: (data: Uint8Array) => Promise<void>) => Promise<boolean>
}

export interface EmbedderIo {
  open: (file: File) => Promise<EmbeddedDocument>
}

/** A frame the bridge talks to: the window it listens on and the parent it answers. */
export interface EmbedderFrame {
  addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void
  removeEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void
  parent: Pick<Window, 'postMessage'>
}

/**
 * The origin the embedder named, as the browser serializes it, or null when the link names none
 * or names something that is not an `http:` or `https:` origin. A path, query, or fragment after
 * the origin is refused rather than dropped, so a typo cannot widen who the app answers.
 */
export function parseEmbedderOrigin(search: string): string | null {
  const given = new URLSearchParams(search).getAll('embedder').at(-1)
  if (!given) return null
  let url: URL
  try {
    url = new URL(given)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  return given === url.origin || given === `${url.origin}/` ? url.origin : null
}

/** Starts answering the embedder at `origin`; returns a function that stops it. */
export function startEmbedderBridge(origin: string, frame: EmbedderFrame, io: EmbedderIo) {
  let document: EmbeddedDocument | null = null
  let stopWatching: (() => void) | null = null
  let stopped = false
  const post = (message: EmbedderMessage, transfer: Transferable[] = []) =>
    frame.parent.postMessage(message, origin, transfer)

  async function open(name: string, data: ArrayBuffer) {
    const opened = await io.open(new File([data], name, { type: 'application/octet-stream' }))
    if (stopped) return
    stopWatching?.()
    document = opened
    stopWatching = watch(
      () => opened.hasUnsavedChanges(),
      (edited) => post({ type: 'openpencil:edited', edited })
    )
    post({ type: 'openpencil:opened' })
  }

  async function save(id: string) {
    if (!document) throw new Error('No document is open')
    await document.saveFigFileCopy(async (bytes) => {
      const data = bytes.slice().buffer
      post({ type: 'openpencil:saved', id, data }, [data])
    })
  }

  function onMessage(event: MessageEvent) {
    if (event.origin !== origin || event.source !== frame.parent) return
    const request = v.safeParse(embedderRequestSchema, event.data)
    if (!request.success) return
    const message = request.output
    const done =
      message.type === 'openpencil:open' ? open(message.name, message.data) : save(message.id)
    done.catch((error: unknown) => {
      const failure = errorMessage(error)
      post(
        message.type === 'openpencil:save'
          ? { type: 'openpencil:failed', id: message.id, message: failure }
          : { type: 'openpencil:failed', message: failure }
      )
    })
  }

  frame.addEventListener('message', onMessage)
  post({ type: 'openpencil:ready' })
  return () => {
    stopped = true
    frame.removeEventListener('message', onMessage)
    stopWatching?.()
  }
}
