import * as v from 'valibot'

import { isTauri } from '@/app/tauri/env'

/** Desktop events and commands for `openpencil://join?room=<id>` links (`desktop/src/lib.rs`). */
export const ROOM_LINKS_EVENT = 'open-room-links'
const TAKE_PENDING_ROOMS = 'take_pending_rooms'

const pendingRoomsSchema = v.array(v.string())

export function roomLinkURL(roomId: string): string {
  return `openpencil://join?room=${encodeURIComponent(roomId)}`
}

/**
 * Opens the rooms of `openpencil://join` links the desktop app received, at startup and while
 * running. The native side validates each room ID; `open` validates it again before joining.
 */
export async function bindDesktopRoomLinks(open: (roomId: string) => void): Promise<() => void> {
  if (!isTauri()) return () => undefined
  const [{ invoke }, { listen }] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/event')
  ])
  async function drain() {
    const rooms = v.parse(pendingRoomsSchema, await invoke<unknown>(TAKE_PENDING_ROOMS))
    for (const roomId of rooms) open(roomId)
  }
  const stop = await listen(ROOM_LINKS_EVENT, () => {
    void drain().catch((error: unknown) => console.error('[Room link]', error))
  })
  await drain()
  return stop
}
