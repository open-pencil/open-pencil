import { IS_TAURI } from '@/constants'

export async function openExternalURL(url: string): Promise<void> {
  if (IS_TAURI) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('open_external_url', { url })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
