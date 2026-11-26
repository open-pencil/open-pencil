import { invoke } from '@tauri-apps/api/core'

export const UPDATER_WINDOW_LABEL = 'updater'

/**
 * Shows the Software Update window, focusing it when it is already open. The desktop app opens
 * it (`desktop/src/system/windows.rs`): the editor creates no windows, since a window's label
 * decides what it may do.
 */
export async function openUpdaterWindow(title: string): Promise<void> {
  try {
    await invoke('open_updater_window', { title })
  } catch (error) {
    console.error('Could not open the Software Update window', error)
  }
}
