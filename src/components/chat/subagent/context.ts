import type { InjectionKey } from 'vue'

/** Opens the thread of the subagent that worked in the ACP session `session`. */
export const OPEN_SUBAGENT_THREAD: InjectionKey<(session: string) => void> =
  Symbol('open-subagent-thread')
