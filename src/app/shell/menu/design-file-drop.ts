import { useEventListener } from '@vueuse/core'

import { toast } from '@/app/shell/ui'
import { openFileInNewTab } from '@/app/tabs'

const DESIGN_EXTENSIONS = ['.fig', '.pen', '.html', '.htm', '.xhtml'] as const

export function isDesignFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return DESIGN_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function filesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt?.files.length) return []
  const out: File[] = []
  for (const file of dt.files) {
    if (isDesignFileName(file.name)) out.push(file)
  }
  return out
}

function hasDesignFiles(e: DragEvent): boolean {
  if (!e.dataTransfer?.types.includes('Files')) return false
  // During dragover, items often have empty `type` for .fig — check filename when available.
  for (const item of e.dataTransfer.items) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file && isDesignFileName(file.name)) return true
    // Chrome often only exposes MIME; octet-stream / empty still may be a design file.
    if (!file && (item.type === '' || item.type === 'application/octet-stream')) return true
  }
  return false
}

/**
 * Window-level drop of .fig / .pen / HTML into the editor shell.
 * (Canvas drop only handles images; without this, design files are silently ignored.)
 */
export function useDesignFileDrop(options?: { enabled?: () => boolean }) {
  const enabled = options?.enabled ?? (() => true)

  useEventListener(
    window,
    'dragover',
    (e: DragEvent) => {
      if (!enabled()) return
      if (!hasDesignFiles(e) && !e.dataTransfer?.types.includes('Files')) return
      // Accept file drags so drop can fire; filter on drop.
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }
    },
    { capture: true }
  )

  useEventListener(
    window,
    'drop',
    (e: DragEvent) => {
      if (!enabled()) return
      if (!e.dataTransfer?.files.length) return
      // Any window-level file drop is ours — never let the browser navigate to the file.
      e.preventDefault()
      e.stopPropagation()
      const files = filesFromDataTransfer(e.dataTransfer)
      if (files.length === 0) return
      void openDesignFiles(files)
    },
    { capture: true }
  )
}

export async function openDesignFiles(files: File[]): Promise<void> {
  for (const file of files) {
    try {
      await openFileInNewTab(file)
    } catch (error) {
      console.error('Failed to open design file:', file.name, error)
      toast.error(
        `Could not open ${file.name}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
