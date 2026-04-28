import { buildFigmaClipboardHTML } from '#core/clipboard'

import type { SceneNode } from '#core/scene-graph'
import type { EditorContext } from '#core/editor/types'

export function createClipboardCopyActions(ctx: EditorContext) {
  async function writeCopyData(clipboardData: DataTransfer, selectedNodes: SceneNode[]) {
    if (selectedNodes.length === 0) return

    const names = selectedNodes.map((n) => n.name).join('\n')
    const html = await buildFigmaClipboardHTML(selectedNodes, ctx.graph)
    if (html) clipboardData.setData('text/html', html)
    clipboardData.setData('text/plain', names)
  }

  return { writeCopyData }
}
