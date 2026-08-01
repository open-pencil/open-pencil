import { IS_TAURI } from '@/constants'

/** True when the browser document or Tauri window is currently fullscreen. */
export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false
  return document.fullscreenElement != null
}

/**
 * Request fullscreen for presentation. Failures (user gesture policy, denied
 * permission, unsupported) are swallowed — presentation still runs windowed.
 */
export async function requestPresentationFullscreen(element?: Element | null): Promise<void> {
  try {
    if (IS_TAURI) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().setFullscreen(true)
      return
    }
    if (typeof document === 'undefined') return
    const target = element ?? document.documentElement
    if (!document.fullscreenElement) {
      await target.requestFullscreen()
    }
  } catch (error) {
    // Fullscreen is best-effort; presentation continues without it.
    console.warn('[presentation] fullscreen request failed', error)
  }
}

/** Leave fullscreen if we own it. Safe when already windowed or unavailable. */
export async function exitPresentationFullscreen(): Promise<void> {
  try {
    if (IS_TAURI) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().setFullscreen(false)
      return
    }
    if (typeof document === 'undefined') return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    }
  } catch (error) {
    // OS may already have left fullscreen.
    console.warn('[presentation] fullscreen exit failed', error)
  }
}
