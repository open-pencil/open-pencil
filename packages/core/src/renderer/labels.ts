import {
  SECTION_TITLE_HEIGHT,
  SECTION_TITLE_PADDING_X,
  SECTION_TITLE_RADIUS,
  SECTION_TITLE_GAP,
  COMPONENT_LABEL_FONT_SIZE,
  COMPONENT_LABEL_GAP,
  COMPONENT_LABEL_ICON_SIZE,
  COMPONENT_LABEL_ICON_GAP
} from '../constants'

import type { SceneNode, SceneGraph } from '../scene-graph'
import type { SkiaRenderer } from './renderer'
import type { Canvas, Font } from 'canvaskit-wasm'

export function drawSectionTitles(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph): void {
  if (!r.sectionTitleFont) return

  const sections = r.labelCache.getSections(graph, r.worldViewport)
  if (sections.length === 0) return

  const font = r.sectionTitleFont
  const ellipsis = '…'
  const ellipsisGlyphs = font.getGlyphIDs(ellipsis)
  const ellipsisWidth = font.getGlyphWidths(ellipsisGlyphs)[0]

  for (const { node, absX, absY, nested } of sections) {
    drawSectionTitle(r, canvas, font, node, graph, absX, absY, nested, ellipsis, ellipsisWidth)
  }
}

function drawSectionTitle(
  r: SkiaRenderer,
  canvas: Canvas,
  font: Font,
  node: SceneNode,
  graph: SceneGraph,
  absX: number,
  absY: number,
  nested: boolean,
  ellipsis: string,
  ellipsisWidth: number
): void {
  const screenX = absX * r.zoom + r.panX
  const screenY = absY * r.zoom + r.panY
  const screenW = node.width * r.zoom
  const maxPillW = Math.max(screenW, 0)

  const glyphIds = font.getGlyphIDs(node.name)
  const widths = font.getGlyphWidths(glyphIds)

  let fullTextWidth = 0
  for (const w of widths) fullTextWidth += w

  const maxTextW = maxPillW - SECTION_TITLE_PADDING_X * 2
  let displayText = node.name
  let textWidth = fullTextWidth

  if (textWidth > maxTextW && maxTextW > ellipsisWidth) {
    let truncW = 0
    let truncIdx = 0
    for (let i = 0; i < widths.length; i++) {
      if (truncW + widths[i] + ellipsisWidth > maxTextW) break
      truncW += widths[i]
      truncIdx = i + 1
    }
    displayText = node.name.slice(0, truncIdx) + ellipsis
    textWidth = truncW + ellipsisWidth
  } else if (maxTextW <= ellipsisWidth) {
    displayText = ellipsis
    textWidth = ellipsisWidth
  }

  const pillW = Math.min(textWidth + SECTION_TITLE_PADDING_X * 2, maxPillW)
  const pillH = SECTION_TITLE_HEIGHT
  const localPillX = 0
  const localPillY = nested ? SECTION_TITLE_GAP : -pillH - SECTION_TITLE_GAP

  const pillColor =
    node.fills.length > 0 && node.fills[0].visible
      ? r.resolveFillColor(node.fills[0], 0, node, graph)
      : { r: 0.37, g: 0.37, b: 0.37, a: 1 }

  canvas.save()
  canvas.translate(screenX, screenY)
  if (node.rotation !== 0) {
    canvas.rotate(node.rotation, 0, 0)
  }

  r.auxFill.setColor(r.ck.Color4f(pillColor.r, pillColor.g, pillColor.b, pillColor.a))
  const pillRect = r.ck.LTRBRect(localPillX, localPillY, localPillX + pillW, localPillY + pillH)
  canvas.drawRRect(r.ck.RRectXY(pillRect, SECTION_TITLE_RADIUS, SECTION_TITLE_RADIUS), r.auxFill)

  const lum = 0.299 * pillColor.r + 0.587 * pillColor.g + 0.114 * pillColor.b
  r.auxFill.setColor(lum > 0.5 ? r.ck.BLACK : r.ck.WHITE)
  const textY = localPillY + pillH * 0.7
  canvas.drawText(displayText, localPillX + SECTION_TITLE_PADDING_X, textY, r.auxFill, font)
  canvas.restore()
}

export function drawComponentLabels(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph): void {
  if (!r.componentLabelFont) return

  const components = r.labelCache.getComponents(graph, r.worldViewport)
  if (components.length === 0) return

  const font = r.componentLabelFont
  const compColor = r.compColor()
  const iconS = COMPONENT_LABEL_ICON_SIZE

  for (const { node, absX, absY, inside } of components) {
    const screenX = absX * r.zoom + r.panX
    const screenY = absY * r.zoom + r.panY

    const labelX = screenX
    let labelY: number
    if (inside) {
      labelY = screenY + COMPONENT_LABEL_GAP + COMPONENT_LABEL_FONT_SIZE
    } else {
      labelY = screenY - COMPONENT_LABEL_GAP
    }

    const iconX = labelX
    const iconY = labelY - COMPONENT_LABEL_FONT_SIZE * 0.75
    const iconCx = iconX + iconS / 2
    const iconCy = iconY + iconS / 2
    const iconR = iconS / 2

    r.auxFill.setColor(compColor)

    if (node.type === 'COMPONENT_SET') {
      const s = iconR * 0.45
      const gap = iconR * 0.2
      const path = new r.ck.Path()
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
      canvas.drawPath(path, r.auxFill)
      path.delete()
    } else {
      const path = new r.ck.Path()
      path.moveTo(iconCx, iconCy - iconR)
      path.lineTo(iconCx + iconR, iconCy)
      path.lineTo(iconCx, iconCy + iconR)
      path.lineTo(iconCx - iconR, iconCy)
      path.close()
      canvas.drawPath(path, r.auxFill)
      path.delete()
    }

    canvas.drawText(node.name, labelX + iconS + COMPONENT_LABEL_ICON_GAP, labelY, r.auxFill, font)
  }
}
