import { useFileDialog } from '@vueuse/core'

import { IS_TAURI } from '@/constants'

export interface PickedComponentMapping {
  text: string
  path?: string
}

/** Only the file explicitly chosen here is read; no repository paths are probed. */
export async function pickComponentMapping(): Promise<PickedComponentMapping | null> {
  if (IS_TAURI) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const path = await open({
      multiple: false,
      filters: [{ name: 'Component mapping', extensions: ['json'] }]
    })
    if (typeof path !== 'string') return null
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    return { path, text: await readTextFile(path) }
  }
  const dialog = useFileDialog({ accept: '.json,application/json', multiple: false, reset: true })
  const file = await new Promise<File | null>((resolve) => {
    const changed = dialog.onChange((files) => {
      changed.off()
      cancelled.off()
      resolve(files?.item(0) ?? null)
    })
    const cancelled = dialog.onCancel(() => {
      changed.off()
      cancelled.off()
      resolve(null)
    })
    dialog.open()
  })
  return file ? { text: await file.text() } : null
}
