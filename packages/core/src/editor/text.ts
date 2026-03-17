import type { EditorContext } from './types'

export function createTextActions(ctx: EditorContext) {
  function startTextEditing(nodeId: string) {
    const te = ctx.getTextEditor()
    if (ctx.state.editingTextId) commitTextEdit()
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
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
      return
    }
    const result = te.stop()
    if (!result) {
      ctx.state.editingTextId = null
      ctx.requestRender()
      return
    }
    const node = ctx.graph.getNode(result.nodeId)
    const prevText = node?.text ?? ''
    const newText = result.text
    ctx.graph.updateNode(result.nodeId, { text: newText })
    ctx.state.editingTextId = null
    if (prevText !== newText) {
      ctx.undo.push({
        label: 'Edit text',
        forward: () => {
          ctx.graph.updateNode(result.nodeId, { text: newText })
        },
        inverse: () => {
          ctx.graph.updateNode(result.nodeId, { text: prevText })
        }
      })
    }
  }

  return { startTextEditing, commitTextEdit }
}
