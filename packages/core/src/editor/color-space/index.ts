import type { ColorProfile } from '@open-pencil/scene-graph'
import { convertColor } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { EditorContext } from '#core/editor/types'

/**
 * How a document takes another color profile, as Figma's File color profile dialog offers it:
 * `assign` keeps every stored number and reads it in the new profile, so colors change; `convert`
 * rewrites the numbers so colors look the same, mapping those the new profile cannot show to the
 * nearest it can.
 */
export type DocumentColorProfileMode = 'assign' | 'convert'

interface ColorSpaceHost {
  loadPageNodes: (pageId: string) => Promise<void>
  /** Why `setDocumentColorSpace` would be refused now, checked again after pages load. */
  refusal: (colorSpace: ColorProfile, mode: DocumentColorProfileMode) => Error | null
}

export function createColorSpaceActions(
  ctx: EditorContext,
  { loadPageNodes, refusal }: ColorSpaceHost
) {
  function setProfile(space: ColorProfile) {
    ctx.graph.documentColorSpace = space
    ctx.emitEditorEvent('document:color-space-changed', space)
    ctx.requestRender()
  }

  /**
   * Gives the document `colorSpace` as one undo step. Assigning keeps every value; converting
   * rewrites every stored color so it looks the same: layers' paints, effects, text runs, layout
   * grids, and vector regions, page backgrounds, and color variables, on every page, loading
   * the pages not opened yet first so none keeps values in the old profile.
   */
  async function setDocumentColorSpace(
    colorSpace: ColorProfile,
    mode: DocumentColorProfileMode = 'assign'
  ): Promise<void> {
    const graph = ctx.graph
    const previous = graph.documentColorSpace
    if (previous === colorSpace) return
    if (mode === 'assign') {
      setProfile(colorSpace)
      ctx.undo.push({
        label: 'Assign color profile',
        forward: () => setProfile(colorSpace),
        inverse: () => setProfile(previous)
      })
      return
    }

    // Converting walks every stored color, which most sessions never need at startup.
    const [{ convertColors, replayConversion }] = await Promise.all([
      import('./convert'),
      ...graph.getPages().map((page) => loadPageNodes(page.id))
    ])
    // The document may have been closed, replaced, converted, or made read-only while its pages
    // loaded; the editor's guard only checked the call as it started.
    if (ctx.graph !== graph || graph.documentColorSpace !== previous) return
    const refused = refusal(colorSpace, mode)
    if (refused) throw refused
    const conversion = convertColors(graph, (color: Color) =>
      convertColor(color, previous, colorSpace, 'map')
    )
    setProfile(colorSpace)
    ctx.undo.push({
      label: 'Convert color profile',
      forward: () => {
        replayConversion(graph, conversion, true)
        setProfile(colorSpace)
      },
      inverse: () => {
        replayConversion(graph, conversion, false)
        setProfile(previous)
      }
    })
  }

  return {
    setDocumentColorSpace
  }
}
