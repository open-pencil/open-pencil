import { IS_TAURI } from '@lawha/core/constants'

/** The desktop app; the mobile app runs the editor as the browser does (see `IS_TAURI`). */
export function isTauri(): boolean {
  return IS_TAURI
}
