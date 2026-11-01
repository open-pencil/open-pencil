export function isTauri(): boolean {
  return 'window' in globalThis && '__TAURI_INTERNALS__' in globalThis.window
}

/**
 * Android runs the same Tauri frontend as desktop, but a growing number of
 * desktop capabilities — child processes, native menus, self-update — have no
 * mobile counterpart. Gate those on the platform, not on viewport width, which
 * only describes the window size.
 *
 * Note: this deliberately does not require `isTauri()`. The web build served to
 * an Android browser should behave the same way as the packaged APK.
 */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}
