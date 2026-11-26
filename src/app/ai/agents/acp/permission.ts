import type { PermissionNotice } from '@/app/tauri/host'
import { AGENT_INPUT_NOTIFY_DELAY_MS } from '@/constants'

/**
 * Tells the person when an agent has waited on the desktop app's permission window for a few
 * seconds, as a question answered at once needs no notification. The window itself asks and
 * answers (`desktop/src/host/permission.rs`); the editor hears only that an agent waits, and
 * which question it is, so two with the same title stay apart.
 */
export function permissionNotifier(notify: ((title: string) => void) | null) {
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  return ({ id, title, waiting }: PermissionNotice) => {
    if (!notify) return
    clearTimeout(timers.get(id))
    timers.delete(id)
    if (waiting)
      timers.set(
        id,
        setTimeout(() => notify(title), AGENT_INPUT_NOTIFY_DELAY_MS)
      )
  }
}
