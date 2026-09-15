import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode, SceneGraph } from '@open-pencil/scene-graph'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import { SECTION_TITLE_RADIUS } from '#core/constants'

import { labelLayout } from './layout'
import { sectionLabelColors } from './style'
import { labelScreenMatrix, labelTransform } from './transform'

export function drawSectionTitles(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays?: RenderOverlays
): void {
  const provider = r.fontProvider
  if (!r.sectionTitleFont || !provider) return

  const sections = r.labelCache.getSections(graph, r.worldViewport, overlays?.rotationPreview)
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
  const initialLayout = labelLayout('section', node.width * r.zoom, nested)
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
      const layout = labelLayout('section', node.width * r.zoom, nested, metrics)
      if (!layout) return
      canvas.save()
      try {
        canvas.concat(labelScreenMatrix(labelTransform(node, graph, overlays?.rotationPreview), r))
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
      } finally {
        canvas.restore()
      }
    },
    initialLayout.fontWeight
  )
}

export function drawComponentLabels(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays?: RenderOverlays
): void {
  if (!r.componentLabelFont || !r.fontProvider) return

  const components = r.labelCache.getComponents(graph, r.worldViewport, overlays?.rotationPreview)
  if (components.length === 0) return

  const provider = r.fontProvider
  const compColor = r.compColor()

  for (const { node, inside } of components) {
    const transform = labelTransform(node, graph, overlays?.rotationPreview)
    const layout = labelLayout('component', node.width * r.zoom, inside)
    if (!layout?.icon) continue
    const iconS = layout.icon.width

    canvas.save()
    canvas.concat(labelScreenMatrix(transform, r))

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

    r.labelParagraphCache.draw(
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
    canvas.restore()
  }
}
