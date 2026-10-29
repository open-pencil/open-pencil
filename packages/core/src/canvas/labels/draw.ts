import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode, SceneGraph } from '@open-pencil/scene-graph'
import type { Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import { shownStatusState } from '@open-pencil/scene-graph/statuses'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import { SECTION_TITLE_RADIUS } from '#core/constants'

import { labelLayout, labelViewport, type LabelLayout } from './layout'
import {
  drawSectionStatus,
  drawStatusDot,
  placeStatusLabel,
  SECTION_STATUS_ROOM,
  statusDotCenter,
  statusDotHitRect,
  TITLE_STATUS_ROOM
} from './status'
import { frameTitleColor, sectionLabelColors } from './style'
import { frameLabelPlacement, labelScreenMatrix, labelTransform } from './transform'

export function drawSectionTitles(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays?: RenderOverlays
): void {
  const provider = r.fontProvider
  if (!r.sectionTitleFont || !provider) return

  const sections = r.labelCache.getSections(
    graph,
    labelViewport(r.worldViewport, r.zoom),
    overlays?.rotationPreview
  )
  if (sections.length === 0) return

  for (const { node, nested } of sections) {
    drawSectionTitle(r, canvas, provider, node, graph, nested, overlays)
  }
}

function drawSectionTitle(
  r: SkiaRenderer,
  canvas: Canvas,
  provider: NonNullable<SkiaRenderer['fontProvider']>,
  node: SceneNode,
  graph: SceneGraph,
  nested: boolean,
  overlays?: RenderOverlays
): void {
  const status = shownStatusState(graph, node)
  // A title leaves room for its status, so zooming out cuts the title short, not the status.
  const titleWidth = node.width * r.zoom - (status ? SECTION_STATUS_ROOM : 0)
  const initialLayout = labelLayout('section', titleWidth, nested)
  if (!initialLayout) return
  const { background, foreground, border, hover } = sectionLabelColors(r, graph, node)
  r.labelParagraphCache.use(
    r.ck,
    provider,
    node.name,
    initialLayout.fontSize,
    initialLayout.maxTextWidth,
    foreground,
    r.fontGeneration,
    ({ paragraph, metrics }) => {
      const layout = labelLayout('section', titleWidth, nested, metrics)
      if (!layout) return
      canvas.save()
      try {
        const matrix = labelScreenMatrix(labelTransform(node, graph, overlays?.rotationPreview), r)
        canvas.concat(matrix)
        r.auxFill.setColor(r.ck.Color4f(background.r, background.g, background.b, background.a))
        const { x, y, width, height } = layout.bounds
        const bounds = r.ck.RRectXY(
          r.ck.LTRBRect(x, y, x + width, y + height),
          SECTION_TITLE_RADIUS,
          SECTION_TITLE_RADIUS
        )
        canvas.drawRRect(bounds, r.auxFill)
        if (overlays?.hoveredNodeId === node.id) {
          r.auxFill.setColor(hover)
          canvas.drawRRect(bounds, r.auxFill)
        }
        r.auxStroke.setColor(border)
        r.auxStroke.setStrokeWidth(1)
        r.auxStroke.setPathEffect(null)
        canvas.drawRRect(bounds, r.auxStroke)
        r.auxFill.setColor(foreground)
        canvas.drawParagraph(paragraph, layout.text.x, layout.text.y)
        if (status) {
          const colors = { background, foreground, border }
          const place = (rect: Rect) => placeStatusLabel(r, node.id, matrix, rect)
          const width = node.width * r.zoom
          drawSectionStatus(r, canvas, provider, status, layout.bounds, colors, width, place)
        }
      } finally {
        canvas.restore()
      }
    },
    initialLayout.fontWeight
  )
}

/** A frame's or component's status, as a dot after its name. */
function drawTitleStatus(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  layout: LabelLayout,
  textWidth: number,
  screenWidth: number,
  matrix: Mat3
): void {
  const status = shownStatusState(graph, node)
  if (!status) return
  const { text, fontSize } = layout
  const center = statusDotCenter(text.x, text.y, textWidth, fontSize, screenWidth)
  if (!center) return
  drawStatusDot(r, canvas, status, center)
  placeStatusLabel(r, node.id, matrix, statusDotHitRect(center))
}

export function drawComponentLabels(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays?: RenderOverlays
): void {
  if (!r.componentLabelFont || !r.fontProvider) return

  const components = r.labelCache.getComponents(
    graph,
    labelViewport(r.worldViewport, r.zoom),
    overlays?.rotationPreview
  )
  if (components.length === 0) return

  const provider = r.fontProvider
  const compColor = r.compColor()

  for (const { node, inside } of components) {
    const transform = labelTransform(node, graph, overlays?.rotationPreview)
    const room = shownStatusState(graph, node) ? TITLE_STATUS_ROOM : 0
    const layout = labelLayout('component', node.width * r.zoom - room, inside)
    if (!layout?.icon) continue
    const iconS = layout.icon.width

    canvas.save()
    const matrix = labelScreenMatrix(transform, r)
    canvas.concat(matrix)

    const iconX = layout.icon.x
    const iconY = layout.icon.y
    const iconCx = iconX + iconS / 2
    const iconCy = iconY + iconS / 2
    const iconR = iconS / 2

    r.auxFill.setColor(compColor)

    if (node.type === 'COMPONENT_SET') {
      const s = iconR * 0.45
      const gap = iconR * 0.2
      const path = new r.ck.PathBuilder()
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ]) {
        const cx = iconCx + dx * (s + gap)
        const cy = iconCy + dy * (s + gap)
        path.moveTo(cx, cy - s)
        path.lineTo(cx + s, cy)
        path.lineTo(cx, cy + s)
        path.lineTo(cx - s, cy)
        path.close()
      }
      const immutablePath = path.detachAndDelete()
      canvas.drawPath(immutablePath, r.auxFill)
      immutablePath.delete()
    } else {
      const path = new r.ck.PathBuilder()
      path.moveTo(iconCx, iconCy - iconR)
      path.lineTo(iconCx + iconR, iconCy)
      path.lineTo(iconCx, iconCy + iconR)
      path.lineTo(iconCx - iconR, iconCy)
      path.close()
      const immutablePath = path.detachAndDelete()
      canvas.drawPath(immutablePath, r.auxFill)
      immutablePath.delete()
    }

    const textWidth = r.labelParagraphCache.draw(
      r.ck,
      canvas,
      provider,
      node.name,
      layout.fontSize,
      layout.maxTextWidth,
      compColor,
      r.fontGeneration,
      layout.text.x,
      layout.text.y,
      layout.fontWeight
    )
    drawTitleStatus(r, canvas, graph, node, layout, textWidth, node.width * r.zoom, matrix)
    canvas.restore()
  }
}

/**
 * Names above the frames on the page and in sections, as Figma shows them: faded, or in the
 * selection color while the frame is selected or hovered. A frame holding layers is a background
 * that a click on its body does not select, so its name is how it is picked.
 */
export function drawFrameTitles(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: ReadonlySet<string>,
  overlays?: RenderOverlays
): void {
  const provider = r.fontProvider
  if (!r.labelFont || !provider) return

  const frames = r.labelCache.getFrames(
    graph,
    labelViewport(r.worldViewport, r.zoom),
    overlays?.rotationPreview
  )
  for (const { node } of frames) {
    const transform = frameLabelPlacement(node, graph, overlays?.rotationPreview)
    const room = shownStatusState(graph, node) ? TITLE_STATUS_ROOM : 0
    const layout = labelLayout('frame', transform.width * r.zoom - room)
    if (!layout) continue
    const highlighted = selectedIds.has(node.id) || overlays?.hoveredNodeId === node.id
    canvas.save()
    const matrix = labelScreenMatrix(transform, r)
    canvas.concat(matrix)
    const textWidth = r.labelParagraphCache.draw(
      r.ck,
      canvas,
      provider,
      node.name,
      layout.fontSize,
      layout.maxTextWidth,
      frameTitleColor(r, graph, node, layout, highlighted, overlays?.rotationPreview),
      r.fontGeneration,
      layout.text.x,
      layout.text.y,
      layout.fontWeight
    )
    drawTitleStatus(r, canvas, graph, node, layout, textWidth, transform.width * r.zoom, matrix)
    canvas.restore()
  }
}
