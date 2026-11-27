import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import { IS_TAURI } from '@/constants'

/** Separate Vite entry, so the presenter's window never boots the editor. */
const PRESENTER_URL = 'presenter.html'
const PRESENTER_WIDTH = 1100
const PRESENTER_HEIGHT = 720

/**
 * Opens the presenter's window for the presentation `presentationId`: the slide on show, the next
 * one, the notes, and a timer, beside the deck filling the screen. In a browser it is a popup,
 * opened from the click that started the presentation so it is not blocked.
 */
export function openPresenterWindow(presentationId: string, title: string): void {
  const url = `${PRESENTER_URL}#${encodeURIComponent(presentationId)}`
  if (!IS_TAURI) {
    window.open(
      url,
      `openpencil-presenter-${presentationId}`,
      `popup,width=${PRESENTER_WIDTH},height=${PRESENTER_HEIGHT}`
    )
    return
  }
  const presenter = new WebviewWindow(`presenter-${presentationId}`, {
    url,
    title,
    width: PRESENTER_WIDTH,
    height: PRESENTER_HEIGHT,
    center: true,
    dragDropEnabled: false,
    focus: true
  })
  void presenter.once<unknown>('tauri://error', (event) => {
    console.error("Could not open the presenter's window", event.payload)
  })
}
