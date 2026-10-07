import { describe, expect, test } from 'bun:test'

import { parseRoomInput } from '@/app/collab/room/id'

const ROOM = 'abcdefghijklmnopqrstuvwxyz012345'

describe('room links and IDs', () => {
  test('reads the room ID from a bare ID or a share link, whatever surrounds it', () => {
    for (const input of [
      ROOM,
      `  ${ROOM}  `,
      `https://app.openpencil.dev/share/${ROOM}`,
      `https://app.openpencil.dev/share/${ROOM}/`,
      `https://app.openpencil.dev/share/${ROOM}?test#layers`,
      `open-pencil.localhost/share/${ROOM}#x`
    ]) {
      expect(parseRoomInput(input)).toBe(ROOM)
    }
  })

  test('refuses text that is not a room ID, so it never joins a room nobody shared', () => {
    for (const input of [
      '',
      'e2e-collaboration-room',
      ROOM.slice(1),
      `${ROOM}0`,
      ROOM.toUpperCase(),
      `https://app.openpencil.dev/share/${ROOM.slice(0, 31)}!`,
      `https://app.openpencil.dev/demo`
    ]) {
      expect(parseRoomInput(input)).toBeNull()
    }
  })
})
