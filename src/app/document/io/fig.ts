import {
  findFigThumbnailPageId,
  populateFigPage,
  readFigFile
} from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { isUnsupportedVariableValue, type SceneGraph } from '@open-pencil/scene-graph'

import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'

export async function readFigDocument(file: File, signal?: AbortSignal, warn = true) {
  const graph = await readFigFile(file, {
    populate: 'first-page',
    signal
  })
  if (warn) warnUnsupportedVariableExpressions(graph)
  return graph
}

/** Names the variables whose expressions OpenPencil cannot evaluate, which draw as saved. */
function warnUnsupportedVariableExpressions(graph: SceneGraph) {
  const names = [...graph.variables.values()]
    .filter((variable) => Object.values(variable.valuesByMode).some(isUnsupportedVariableValue))
    .map((variable) => variable.name)
  if (names.length === 0) return
  toast.warning(
    notificationMessages.get().unsupportedVariableExpressions({ names: names.join(', ') })
  )
}

/**
 * Reads a .fig with its first page, and its cover page when it has one, laid out to draw.
 * `warn: false` keeps the notice about unsupported variable expressions for designs the person
 * opens, not ones drawn in the background.
 */
export async function readFigForDisplay(
  file: File,
  signal?: AbortSignal,
  options: { warn?: boolean } = {}
): Promise<SceneGraph> {
  const imported = await readFigDocument(file, signal, options.warn ?? true)
  const firstPageId = imported.getPages()[0]?.id
  const layOut = (pageId: string) =>
    imported.applyDerivedLayoutDuring(() => computeAllLayouts(imported, pageId))
  if (firstPageId) layOut(firstPageId)
  const coverPageId = findFigThumbnailPageId(imported.getPages())
  if (coverPageId && coverPageId !== firstPageId) {
    populateFigPage(imported, coverPageId)
    layOut(coverPageId)
  }
  return imported
}
