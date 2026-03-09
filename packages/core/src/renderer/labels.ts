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
import type { Canvas } from 'canvaskit-wasm'
import type { SkiaRenderer } from './renderer'

export function drawSectionTitles(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph): void {
  if (!r.sectionTitleFont) return

  const pageNode = graph.getNode(r.pageId ?? graph.rootId)
  if (!pageNode) return

  const sections: { node: SceneNode; absX: number; absY: number; nested: boolean }[] = []
  const collectSections = (parentId: string, ox: number, oy: number, insideSection: boolean) => {
    const parent = graph.getNode(parentId)
    if (!parent) return
    for (const childId of parent.childIds) {
      const child = graph.getNode(childId)
      if (!child || !child.visible) continue
      const ax = ox + child.x
      const ay = oy + child.y
      if (child.type === 'SECTION') {
        const vp = r.worldViewport
        if (
          ax + child.width >= vp.x &&
          ay + child.height >= vp.y &&
          ax <= vp.x + vp.w &&
          ay <= vp.y + vp.h
        ) {
          sections.push({ node: child, absX: ax, absY: ay, nested: insideSection })
        }
        collectSections(childId, ax, ay, true)
      } else if (child.childIds.length > 0) {
        collectSections(childId, ax, ay, insideSection)
      }
    }
  }
  collectSections(pageNode.id, 0, 0, false)

  const font = r.sectionTitleFont
  const ellipsis = '…'
  const ellipsisGlyphs = font.getGlyphIDs(ellipsis)
  const ellipsisWidth = font.getGlyphWidths(ellipsisGlyphs)[0]

  for (const { node, absX, absY, nested } of sections) {
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
    const pillX = screenX
    const pillY = nested ? screenY + SECTION_TITLE_GAP : screenY - pillH - SECTION_TITLE_GAP

    if (node.fills.length > 0 && node.fills[0].visible) {
      const c = node.fills[0].color
      r.auxFill.setColor(r.ck.Color4f(c.r, c.g, c.b, node.fills[0].opacity))
    } else {
      r.auxFill.setColor(r.ck.Color4f(0.37, 0.37, 0.37, 1))
    }
    const pillRect = r.ck.LTRBRect(pillX, pillY, pillX + pillW, pillY + pillH)
    canvas.drawRRect(
      r.ck.RRectXY(pillRect, SECTION_TITLE_RADIUS, SECTION_TITLE_RADIUS),
      r.auxFill
    )

    const pillColor =
      node.fills.length > 0 && node.fills[0].visible
        ? node.fills[0].color
        : { r: 0.37, g: 0.37, b: 0.37 }
    const lum = 0.299 * pillColor.r + 0.587 * pillColor.g + 0.114 * pillColor.b
    r.auxFill.setColor(lum > 0.5 ? r.ck.BLACK : r.ck.WHITE)
    const textY = pillY + pillH * 0.7
    canvas.drawText(displayText, pillX + SECTION_TITLE_PADDING_X, textY, r.auxFill, font)
  }
}

export function drawComponentLabels(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph): void {
  if (!r.componentLabelFont) return

  const pageNode = graph.getNode(r.pageId ?? graph.rootId)
  if (!pageNode) return

  const font = r.componentLabelFont
  const LABEL_TYPES = new Set(['COMPONENT', 'COMPONENT_SET'])

  const nodes: { node: SceneNode; absX: number; absY: number; inside: boolean }[] = []
  const collect = (parentId: string, ox: number, oy: number) => {
    const parent = graph.getNode(parentId)
    if (!parent) return
    for (const childId of parent.childIds) {
      const child = graph.getNode(childId)
      if (!child || !child.visible) continue
      const ax = ox + child.x
      const ay = oy + child.y
      if (LABEL_TYPES.has(child.type)) {
        const vp = r.worldViewport
        if (
          ax + child.width >= vp.x &&
          ay + child.height >= vp.y &&
          ax <= vp.x + vp.w &&
          ay <= vp.y + vp.h
        ) {
          const isInsideSet = parent.type === 'COMPONENT_SET'
          nodes.push({ node: child, absX: ax, absY: ay, inside: isInsideSet })
        }
      }
      if (child.childIds.length > 0) {
        collect(childId, ax, ay)
      }
    }
  }
  collect(pageNode.id, 0, 0)

  const compColor = r.compColor()

  const iconS = COMPONENT_LABEL_ICON_SIZE

  for (const { node, absX, absY, inside } of nodes) {
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

    canvas.drawText(
      node.name,
      labelX + iconS + COMPONENT_LABEL_ICON_GAP,
      labelY,
      r.auxFill,
      font
    )
  }
}
