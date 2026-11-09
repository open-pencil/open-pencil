import * as v from 'valibot'

import { liveSelectionSchema, type LiveSelection } from './schema'

/** The message a page sends: a named envelope, so a frame's own chatter is never mistaken for it. */
const selectionEnvelopeSchema = v.object({
  source: v.literal('open-pencil'),
  type: v.literal('select'),
  payload: v.unknown()
})

/** The selection a message carries, or null for anything that is not one this app accepts. */
export function readLiveSelection(data: unknown): LiveSelection | null {
  const envelope = v.safeParse(selectionEnvelopeSchema, data)
  if (!envelope.success) return null
  const payload = v.safeParse(liveSelectionSchema, envelope.output.payload)
  return payload.success ? payload.output : null
}

/**
 * Where a selection lives, as a person reads a path: `components/Card.vue:42` for a selection that
 * names a line, and the file alone otherwise.
 */
export function selectionLocation(selection: LiveSelection): string {
  return selection.line === undefined ? selection.file : `${selection.file}:${selection.line}`
}

/** The origin a page's address answers on, or null for an address this app cannot read. */
export function pageOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch (error) {
    console.warn('[LivePages] A page address could not be read:', url, error)
    return null
  }
}
