import { useFileDialog } from '@vueuse/core'

import type { Editor } from '@open-pencil/core'
import { IMPORTABLE_RASTER_TYPES } from '@open-pencil/scene-graph/images'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { filterCanvasFiles } from '@open-pencil/vue/canvas/drop'

import { getActiveEditorStore } from '@/app/editor/active-store'
import { pastePoint } from '@/app/editor/clipboard/paste/content'
import { pasteHTMLAsLayers } from '@/app/editor/clipboard/paste/web'
import { DOM_DOCUMENT_EXTENSIONS, isDOMDocumentFile } from '@/app/shell/menu/files'
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
  if (shown.length > 0) await editor.placeFiles(shown, point.x, point.y)
  for (const page of files.filter((file) => isDOMDocumentFile(file.name))) {
    await pasteHTMLAsLayers(editor, await page.text(), point)
  }
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
