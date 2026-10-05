import { useEventListener } from '@vueuse/core'

import { filterCanvasFiles } from '@open-pencil/vue'

import { openDesignFile, openDesignFileBatch } from '@/app/shell/menu/files'

interface DroppedFile {
  file: File
  handle: Promise<FileSystemFileHandle | null>
}

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false
}

/** A file handle lets the tab save back to the dropped file; only Chromium provides one. */
async function fileHandle(item: DataTransferItem): Promise<FileSystemFileHandle | null> {
  if (!item.getAsFileSystemHandle) return null
  try {
    const handle = await item.getAsFileSystemHandle()
    return handle instanceof FileSystemFileHandle ? handle : null
  } catch {
    return null
  }
}

/**
 * The dropped files and their handles. The drag data is only readable while the drop event
 * runs, so every file and handle request is taken before anything awaits.
 */
function droppedFiles(transfer: DataTransfer): DroppedFile[] {
  const dropped: DroppedFile[] = []
  for (const item of transfer.items) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file) dropped.push({ file, handle: fileHandle(item) })
  }
  return dropped
}

/**
 * Opens documents dropped anywhere on the window in new tabs, as File → Open does. Images and
 * SVG files stay with the canvas, which places them; any other file reports that it cannot be
 * opened instead of being ignored.
 */
export function useDocumentDrop() {
  useEventListener(window, 'dragover', (event: DragEvent) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  })

  useEventListener(window, 'drop', (event: DragEvent) => {
    if (!event.dataTransfer || !hasFiles(event)) return
    // Without this the browser would navigate away to show the file.
    event.preventDefault()
    // Classify each file itself: `getAsFile()` may return a new `File`, not one from `files`.
    const documents = droppedFiles(event.dataTransfer).filter(
      ({ file }) => filterCanvasFiles([file]).length === 0
    )
    if (documents.length === 0) return
    void openDesignFileBatch(
      documents,
      ({ file }) => file.name,
      async ({ file, handle }) => openDesignFile(file, (await handle) ?? undefined)
    )
  })
}
