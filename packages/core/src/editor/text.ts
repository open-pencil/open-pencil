import {
  createTextEditSession,
  snapshotTextNode,
  textSnapshotChanged,
  type TextEditSession
} from './text/session'

import type { EditorContext } from './types'

export function createTextActions(ctx: EditorContext) {
  let activeSession: TextEditSession | null = null

  function startTextEditing(nodeId: string) {
    const te = ctx.getTextEditor()
    if (ctx.state.editingTextId) commitTextEdit()
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    activeSession = createTextEditSession(node)
    ctx.state.editingTextId = nodeId
    if (te) {
      te.setRenderer(ctx.getRenderer())
      te.start(node)
    }
    ctx.requestRender()
  }

  function commitTextEdit() {
    const te = ctx.getTextEditor()
    if (!te?.isActive) {
      ctx.state.editingTextId = null
      activeSession = null
      return
    }
    const result = te.stop()
    if (!result) {
      ctx.state.editingTextId = null
      activeSession = null
      ctx.requestRender()
      return
    }
    const before = activeSession?.before ?? { text: '', styleRuns: [] }
    const node = ctx.graph.getNode(result.nodeId)
    const after = snapshotTextNode(node, result.text)
    after.text = result.text
    ctx.graph.updateNode(result.nodeId, { text: after.text, styleRuns: after.styleRuns })
    ctx.state.editingTextId = null
    activeSession = null

    if (textSnapshotChanged(before, after)) {
      ctx.undo.push({
        label: 'Edit text',
        forward: () => {
          ctx.graph.updateNode(result.nodeId, { text: after.text, styleRuns: after.styleRuns })
        },
        inverse: () => {
          ctx.graph.updateNode(result.nodeId, { text: before.text, styleRuns: before.styleRuns })
        }
      })
    }
  }

  return { startTextEditing, commitTextEdit }
}
