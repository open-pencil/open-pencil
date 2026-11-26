import { AGENT_INPUT_NOTIFY_DELAY_MS } from '@/constants'

/**
 * Tells the person when an agent has waited on the desktop app's permission window for a few
 * seconds, as a question answered at once needs no notification. The window itself asks and
 * answers (`desktop/src/host/permission.rs`); the editor hears only that an agent waits.
 */
export function permissionNotifier(notify: ((title: string) => void) | null) {
  const waiting: { title: string; timer: ReturnType<typeof setTimeout> }[] = []
  return ({ title, waiting: asks }: { title: string; waiting: boolean }) => {
    if (!notify) return
    if (asks) {
      const entry = {
        title,
        timer: setTimeout(() => {
          waiting.splice(waiting.indexOf(entry), 1)
          notify(title)
        }, AGENT_INPUT_NOTIFY_DELAY_MS)
      }
      waiting.push(entry)
      return
    }
    const index = waiting.findIndex((entry) => entry.title === title)
    if (index === -1) return
    clearTimeout(waiting[index]?.timer)
    waiting.splice(index, 1)
  }
}
