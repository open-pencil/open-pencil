export const UPDATER_WINDOW_LABEL = 'updater'
/** Separate Vite entry, so the window never boots the editor. */
export const UPDATER_WINDOW_URL = 'updater.html'

const UPDATER_WINDOW_WIDTH = 560
const UPDATER_WINDOW_HEIGHT = 520

/** Shows the Software Update window, focusing it when it is already open. */
export async function openUpdaterWindow(title: string): Promise<void> {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const existing = await WebviewWindow.getByLabel(UPDATER_WINDOW_LABEL)
  if (existing) {
    await existing.unminimize()
    await existing.setFocus()
    return
  }

  const window = new WebviewWindow(UPDATER_WINDOW_LABEL, {
    url: UPDATER_WINDOW_URL,
    title,
    width: UPDATER_WINDOW_WIDTH,
    height: UPDATER_WINDOW_HEIGHT,
    minWidth: UPDATER_WINDOW_WIDTH,
    minHeight: UPDATER_WINDOW_HEIGHT,
    center: true,
    minimizable: false,
    maximizable: false,
    dragDropEnabled: false,
    focus: true
  })
  await window.once<unknown>('tauri://error', (event) => {
    console.error('Could not open the Software Update window', event.payload)
  })
}
