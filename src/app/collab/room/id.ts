import * as v from 'valibot'

import { ROOM_ID_CHARS, ROOM_ID_LENGTH } from '@/constants'

// The alphabet is plain lowercase letters and digits, so it needs no escaping in a class.
const roomIdSchema = v.pipe(
  v.string(),
  v.regex(new RegExp(`^[${ROOM_ID_CHARS}]{${ROOM_ID_LENGTH}}$`))
)

export function isRoomId(value: string): boolean {
  return v.is(roomIdSchema, value)
}

/**
 * The room ID in what someone pasted: a bare ID or a room link, with any query, hash, or
 * trailing slash. Null when it is not a room ID, so a mistyped link never joins another room.
 */
export function parseRoomInput(text: string): string | null {
  let candidate = text.trim()
  const roomIndex = candidate.lastIndexOf('/rooms/')
  if (roomIndex !== -1) candidate = candidate.slice(roomIndex + '/rooms/'.length)
  candidate = candidate.split(/[?#]/)[0] ?? ''
  candidate = candidate.replace(/\/+$/, '')
  return isRoomId(candidate) ? candidate : null
}
