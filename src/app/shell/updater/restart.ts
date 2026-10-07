import * as v from 'valibot'

import { randomHex } from '@open-pencil/scene-graph/random'

import { createDeferred } from '@/app/runtime/deferred'

// The Software Update window owns no documents, so it asks the editor window
// to run the same unsaved-changes approval as Quit before the app restarts.
export const RESTART_REQUEST_EVENT = 'updater:restart-request'
export const RESTART_REPLY_EVENT = 'updater:restart-reply'
export const EDITOR_WINDOW_LABEL = 'main'

export const RestartRequest = v.object({ id: v.string() })
export const RestartReply = v.object({ id: v.string(), approved: v.boolean() })

/** Called from the Software Update window; resolves true once the editor's documents may close. */
export async function requestRestartApproval(): Promise<boolean> {
  const [{ emitTo, listen, TauriEvent }, { WebviewWindow }] = await Promise.all([
    import('@tauri-apps/api/event'),
    import('@tauri-apps/api/webviewWindow')
  ])
  const editor = await WebviewWindow.getByLabel(EDITOR_WINDOW_LABEL)
  if (!editor) return true

  const id = randomHex(8)
  const reply = createDeferred<boolean>()
  const stopReply = await listen<unknown>(RESTART_REPLY_EVENT, ({ payload }) => {
    const parsed = v.safeParse(RestartReply, payload)
    if (parsed.success && parsed.output.id === id) reply.resolve(parsed.output.approved)
  })
  // No timeout: the reply waits for the person to answer the unsaved-documents prompt.
  // An editor closed meanwhile has run its own prompt and holds no documents, so it approves.
  const stopDestroyed = await editor.once(TauriEvent.WINDOW_DESTROYED, () => reply.resolve(true))
  if (!(await WebviewWindow.getByLabel(EDITOR_WINDOW_LABEL))) reply.resolve(true)
  try {
    await emitTo(EDITOR_WINDOW_LABEL, RESTART_REQUEST_EVENT, { id })
    return await reply.promise
  } finally {
    stopReply()
    stopDestroyed()
  }
}
