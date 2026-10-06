import type { Platform } from '@tauri-apps/plugin-os'

export interface NativeOSFacts {
  platform: Platform
  version: string
}

/** Read the OS plugin facts through its global API inside the built WebView. */
export async function nativeOSFacts(): Promise<NativeOSFacts> {
  return browser.execute(() => {
    const os = window.__TAURI__?.os
    if (!os) throw new Error('Native test requires the OS plugin global API')
    return { platform: os.platform(), version: os.version() }
  })
}
