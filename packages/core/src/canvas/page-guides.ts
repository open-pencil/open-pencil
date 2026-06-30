import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { SELECTION_COLOR } from '#core/constants'

import type { SkiaRenderer } from './renderer'

interface RawGuide {
  axis?: string
  offset?: number
}

function rawGuides(graph: SceneGraph, pageId?: string | null): RawGuide[] {
  const pageNode = graph.getNode(pageId ?? graph.rootId)
  const guides = pageNode?.source.fig.rawNodeFields.guides
  if (!Array.isArray(guides)) return []
  return guides.filter((guide): guide is RawGuide => guide !== null && typeof guide === 'object')
}

export function drawPageGuides(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph): void {
  const guides = rawGuides(graph, r.pageId)
  if (guides.length === 0) return

  r.auxStroke.setStrokeWidth(1)
  r.auxStroke.setColor(r.ck.Color4f(SELECTION_COLOR.r, SELECTION_COLOR.g, SELECTION_COLOR.b, 0.65))

  for (const guide of guides) {
    if (typeof guide.offset !== 'number') continue
    if (guide.axis === 'X') {
      const x = guide.offset * r.zoom + r.panX
      canvas.drawRect(r.ck.LTRBRect(x, 0, x + 1, r.viewportHeight), r.auxStroke)
    } else if (guide.axis === 'Y') {
      const y = guide.offset * r.zoom + r.panY
      canvas.drawRect(r.ck.LTRBRect(0, y, r.viewportWidth, y + 1), r.auxStroke)
    }
  }
}
