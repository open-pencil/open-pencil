import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'

import { getGuideScreenSegment } from './geometry'

const GUIDE_COLOR = { r: 0.85, g: 0.29, b: 0.2, a: 0.78 }
const HOVERED_GUIDE_COLOR = { r: 0.96, g: 0.4, b: 0.26, a: 1 }
const SELECTED_GUIDE_COLOR = { r: 0.1, g: 0.45, b: 0.95, a: 1 }
const GUIDE_DASH = [3, 4]

type GuideVisualState = 'idle' | 'hovered' | 'selected'

function guideColor(state: GuideVisualState) {
  if (state === 'selected') return SELECTED_GUIDE_COLOR
  if (state === 'hovered') return HOVERED_GUIDE_COLOR
  return GUIDE_COLOR
}

function guideState(selected: boolean, hovered: boolean): GuideVisualState {
  if (selected) return 'selected'
  if (hovered) return 'hovered'
  return 'idle'
}

function drawGuide(
  r: SkiaRenderer,
  canvas: Canvas,
  owner: SceneNode,
  graph: SceneGraph,
  axis: 'x' | 'y',
  position: number,
  preview: boolean,
  state: GuideVisualState = 'idle'
): void {
  const color = guideColor(state)
  r.auxStroke.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
  const segment = getGuideScreenSegment(
    graph,
    owner,
    { axis, position },
    {
      panX: r.panX,
      panY: r.panY,
      zoom: r.zoom,
      width: r.viewportWidth,
      height: r.viewportHeight
    }
  )
  if (owner.type === 'CANVAS') {
    if (axis === 'x') {
      canvas.drawRect(
        r.ck.LTRBRect(segment.x1, segment.y1, segment.x1 + 1, segment.y2),
        r.auxStroke
      )
    } else {
      canvas.drawRect(
        r.ck.LTRBRect(segment.x1, segment.y1, segment.x2, segment.y1 + 1),
        r.auxStroke
      )
    }
  } else {
    canvas.drawLine(segment.x1, segment.y1, segment.x2, segment.y2, r.auxStroke)
  }

  if (!preview || owner.type === 'CANVAS') return
  const dash = r.ck.PathEffect.MakeDash(GUIDE_DASH, 0)
  r.auxStroke.setPathEffect(dash)
  if (axis === 'x') canvas.drawLine(segment.x1, 0, segment.x1, r.viewportHeight, r.auxStroke)
  else canvas.drawLine(0, segment.y1, r.viewportWidth, segment.y1, r.auxStroke)
  r.auxStroke.setPathEffect(null)
  dash.delete()
}

export function drawGuides(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  guides: RenderOverlays['guides']
): void {
  const page = graph.getNode(r.pageId ?? graph.rootId)
  if (!page) return
  const preview = guides?.preview
  const hovered = guides?.hovered
  const selected = guides?.selected

  r.auxStroke.setStrokeWidth(1)
  const visit = (owner: SceneNode) => {
    for (const guide of owner.guides) {
      if (preview?.source?.ownerId === owner.id && preview.source.guideId === guide.id) continue
      drawGuide(
        r,
        canvas,
        owner,
        graph,
        guide.axis,
        guide.position,
        false,
        guideState(
          selected?.ownerId === owner.id && selected.guideId === guide.id,
          hovered?.ownerId === owner.id && hovered.guideId === guide.id
        )
      )
    }
    for (const childId of owner.childIds) {
      const child = graph.getNode(childId)
      if (child) visit(child)
    }
  }
  visit(page)

  if (preview) {
    const owner = graph.getNode(preview.ownerId)
    if (owner) drawGuide(r, canvas, owner, graph, preview.axis, preview.position, true, 'selected')
  }
}
