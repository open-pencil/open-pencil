import { emitTo, listen } from '@tauri-apps/api/event'
import * as v from 'valibot'
import { onScopeDispose } from 'vue'

import { confirmAppExit } from '@/app/document/close/exit'
import { isTauri } from '@/app/tauri/env'

import { RESTART_REPLY_EVENT, RESTART_REQUEST_EVENT } from './restart'
import { restartRequestSchema } from './schema'
import { UPDATER_WINDOW_LABEL } from './window'

/** Lets the editor window answer restart requests from the Software Update window. */
export function useRestartApprovals(): void {
  if (!isTauri()) return
  let stop: (() => void) | undefined
  let disposed = false

  async function register() {
    const unlisten = await listen<unknown>(RESTART_REQUEST_EVENT, ({ payload }) => {
      const parsed = v.safeParse(restartRequestSchema, payload)
      if (!parsed.success) return
      const { id } = parsed.output
      // Always answer, so the Software Update window never waits on a failed prompt.
      void confirmAppExit()
        .catch((error: unknown) => {
          console.error('[Updater] Could not ask about unsaved documents', error)
          return false
        })
        .then((approved) => emitTo(UPDATER_WINDOW_LABEL, RESTART_REPLY_EVENT, { id, approved }))
    })
    if (disposed) unlisten()
    else stop = unlisten
  }
  void register()

  onScopeDispose(() => {
    disposed = true
    stop?.()
  })
}
