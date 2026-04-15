import { IS_TAURI } from '@open-pencil/core'

export async function openExternalLink(url: string) {
  if (IS_TAURI) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank')
  }
}
