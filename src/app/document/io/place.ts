import { useFileDialog } from '@vueuse/core'

import type { Editor } from '@open-pencil/core'
import { IMPORTABLE_RASTER_TYPES } from '@open-pencil/scene-graph/images'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { errorMessage } from '@open-pencil/std/errors'
import { filterCanvasFiles } from '@open-pencil/vue/canvas/drop'

import { getActiveEditorStore } from '@/app/editor/active-store'
import { pastePoint } from '@/app/editor/clipboard/paste/content'
import { notificationMessages } from '@/app/i18n/notifications'
import { DOM_DOCUMENT_EXTENSIONS, isDOMDocumentFile } from '@/app/shell/menu/files'
import { toast } from '@/app/shell/ui'
import { showsDocument } from '@/app/tabs'

/**
 * Places files on the current page at `point`: images and SVG as the canvas places them, and HTML
 * pages as their layers, laid out as HTML import lays them out, as pasting HTML does. Other files
 * are left out.
 */
export async function placeFiles(
  editor: Editor,
  files: readonly File[],
  point: Vector
): Promise<void> {
  const shown = filterCanvasFiles(files)
  if (shown.length > 0) {
    await editor.placeFiles(shown, point.x, point.y).catch((error: unknown) => {
      reportFailure(shown.map((file) => file.name).join(', '), error)
    })
  }
  // Each page on its own, so one that cannot be read is reported and the rest still land.
  for (const page of files.filter((file) => isDOMDocumentFile(file.name))) {
    try {
      // The HTML importer loads on demand, kept out of the editor's startup code.
      const { pasteHTMLAsLayers } = await import('@/app/editor/clipboard/paste/web')
      await pasteHTMLAsLayers(editor, await page.text(), point)
    } catch (error) {
      reportFailure(page.name, error)
    }
  }
}

function reportFailure(name: string, error: unknown): void {
  console.error(`Failed to place ${name}:`, error)
  const detail = errorMessage(error)
  toast.error(notificationMessages.get().openFileFailed({ name, error: detail }))
}

/** What File → Place… offers: the images and SVG the canvas places, and HTML pages. */
const PLACEABLE = [
  ...IMPORTABLE_RASTER_TYPES,
  '.svg',
  ...DOM_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`)
].join(',')

const placeDialog = useFileDialog({ accept: PLACEABLE, multiple: true, reset: true })

placeDialog.onChange((files) => {
  if (!files || files.length === 0 || !showsDocument()) return
  const editor = getActiveEditorStore()
  void placeFiles(editor, Array.from(files), pastePoint(editor))
})

/** File → Place…: picks images, SVG, or HTML pages and places them in the middle of the view. */
export function createPlaceMenuActions() {
  return {
    place: () => {
      if (showsDocument()) placeDialog.open()
    }
  }
}
