import type { SceneNode } from '@open-pencil/scene-graph'

import { buildFigmaClipboardHTML, buildOpenPencilClipboardHTML } from '#core/clipboard'
import type { EditorContext } from '#core/editor/types'

export function createClipboardCopyActions(ctx: EditorContext) {
  async function writeCopyData(clipboardData: DataTransfer, selectedNodes: SceneNode[]) {
    if (selectedNodes.length === 0) return

    const names = selectedNodes.map((n) => n.name).join('\n')
    clipboardData.setData('text/html', buildOpenPencilClipboardHTML(selectedNodes, ctx.graph))
    clipboardData.setData('text/plain', names)

    const html = await buildFigmaClipboardHTML(selectedNodes, ctx.graph)
    if (html) clipboardData.setData('text/html', html)
  }

  return { writeCopyData }
}
