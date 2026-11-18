import { invoke } from '@tauri-apps/api/core'
import { Update } from '@tauri-apps/plugin-updater'

import type { UpdateChannel } from './channel'

/** What the desktop's `check_for_update` returns, as the updater plugin's own check does. */
interface UpdateMetadata {
  rid: number
  currentVersion: string
  version: string
  date?: string
  body?: string
  rawJson: Record<string, unknown>
}

/**
 * Checks the channel's feed. On the other channel than the installed build's, its newest build
 * counts as an update even when older, so switching to stable takes effect at the next check.
 * The plugin downloads and installs the result as it does its own check's (`desktop/src/updates.rs`).
 */
export async function checkUpdateChannel(channel: UpdateChannel): Promise<Update | null> {
  const metadata = await invoke<UpdateMetadata | null>('check_for_update', { channel })
  return metadata ? new Update(metadata) : null
}
