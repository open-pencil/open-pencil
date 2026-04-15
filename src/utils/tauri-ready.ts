import { IS_BROWSER } from '@open-pencil/core'

/**
 * `__TAURI_INTERNALS__` is injected into the WebView's main world by
 * Tauri's preload before the bundle runs, but on some host webviews
 * (notably WebKit2GTK 2.52 on Linux) the injection occasionally races
 * module evaluation and is missing when constants like `IS_TAURI` are
 * first computed. A module-level boolean captures the wrong answer
 * forever and silently disables Tauri-only features.
 *
 * Use this helper inside async hooks (onMounted, etc.) instead of
 * reading `IS_TAURI` directly. It returns immediately if the globals
 * are already present, otherwise polls briefly until they appear.
 */
export async function tauriReady(timeoutMs = 1500): Promise<boolean> {
  if (!IS_BROWSER) return false
  if ('__TAURI_INTERNALS__' in window) return true
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50))
    if ('__TAURI_INTERNALS__' in window) return true
  }
  return '__TAURI_INTERNALS__' in window
}
