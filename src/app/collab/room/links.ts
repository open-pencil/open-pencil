import * as v from 'valibot'

import { bindDesktopLinkQueue } from '@/app/tauri/link-queue'

/** Desktop events and commands for `openpencil://join?room=<id>` links (`desktop/src/lib.rs`). */
export const ROOM_LINKS_EVENT = 'open-room-links'
const TAKE_PENDING_ROOMS = 'take_pending_rooms'

export function roomLinkURL(roomId: string): string {
  return `openpencil://join?room=${encodeURIComponent(roomId)}`
}

/**
 * Opens the rooms of `openpencil://join` links the desktop app received, at startup and while
 * running. The native side validates each room ID; `open` validates it again before joining.
 */
export function bindDesktopRoomLinks(open: (roomId: string) => void): Promise<() => void> {
  return bindDesktopLinkQueue({
    event: ROOM_LINKS_EVENT,
    command: TAKE_PENDING_ROOMS,
    schema: v.string(),
    label: 'Room link',
    open
  })
}
