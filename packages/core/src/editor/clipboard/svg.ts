import { resolvePasteTarget } from '#core/editor/clipboard/paste-target'
import type { EditorContext } from '#core/editor/types'
import { createSvgNodes } from '#core/tools/create/svg'

import { deleteIds, recreateSnapshots } from './history'
import { collectSubtrees } from './subtree-history'

const SVG_GAP = 20

export function createClipboardSvgActions(ctx: EditorContext) {
  /** Import dropped/pasted SVG files as vector frames centered around (cx, cy). */
  async function placeSvgFiles(files: File[], cx: number, cy: number) {
    const parentId = resolvePasteTarget(ctx)
    const prevSelection = new Set(ctx.state.selectedIds)

    const frames = []
    for (const file of files) {
      const markup = await file.text()
      const frame = createSvgNodes(ctx.graph, parentId, markup, {
        name: file.name.replace(/\.svg$/i, '') || 'SVG'
      })
      if (frame) frames.push(frame)
    }
    if (!frames.length) return

    let totalW = 0
    for (const f of frames) totalW += f.width
    totalW += SVG_GAP * (frames.length - 1)
    const maxH = Math.max(...frames.map((f) => f.height))

    let curX = cx - totalW / 2
    const topY = cy - maxH / 2
    for (const frame of frames) {
      ctx.graph.updateNode(frame.id, { x: curX, y: topY })
      curX += frame.width + SVG_GAP
    }

    const created = frames.map((f) => f.id)
    const allNodes = collectSubtrees(ctx.graph, created)
    const pageId = ctx.state.currentPageId
    ctx.undo.push({
      label: 'Import SVG',
      forward: () => {
        recreateSnapshots(ctx, allNodes, pageId)
        ctx.setSelectedIds(new Set(created))
      },
      inverse: () => {
        deleteIds(ctx, created)
        ctx.setSelectedIds(prevSelection)
      }
    })

    ctx.setSelectedIds(new Set(created))
    ctx.requestRender()
  }

  return { placeSvgFiles }
}
