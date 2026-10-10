import * as v from 'valibot'

import { isTauri } from '@/app/tauri/env'

/**
 * Hands the desktop app's queued links to `open`: those that arrived before the editor started,
 * then each batch the native side announces with `event`. `command` drains the queue, and its
 * answer is checked against `schema` before anything opens.
 */
export async function bindDesktopLinkQueue<T>(options: {
  event: string
  command: string
  schema: v.GenericSchema<unknown, T>
  label: string
  open: (item: T) => unknown
}): Promise<() => void> {
  if (!isTauri()) return () => undefined
  const [{ invoke }, { listen }] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/event')
  ])
  const queue = v.array(options.schema)
  async function drain() {
    const items = v.parse(queue, await invoke<unknown>(options.command))
    for (const item of items) await options.open(item)
  }
  const stop = await listen(options.event, () => {
    void drain().catch((error: unknown) => console.error(`[${options.label}]`, error))
  })
  await drain()
  return stop
}
