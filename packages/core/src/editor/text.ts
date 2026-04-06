import type { SceneNode } from '../scene-graph'
import type { EditorContext } from './types'

export function createTextActions(ctx: EditorContext) {
  let textBeforeEdit: string | null = null
  let styleRunsBeforeEdit: SceneNode['styleRuns'] | null = null

  function startTextEditing(nodeId: string) {
    const te = ctx.getTextEditor()
    if (ctx.state.editingTextId) commitTextEdit()
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    textBeforeEdit = node.text
    styleRunsBeforeEdit = structuredClone(node.styleRuns)
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
      textBeforeEdit = null
      styleRunsBeforeEdit = null
      return
    }
    const result = te.stop()
    if (!result) {
      ctx.state.editingTextId = null
      textBeforeEdit = null
      styleRunsBeforeEdit = null
      ctx.requestRender()
      return
    }
    const prevText = textBeforeEdit ?? ''
    const prevRuns = styleRunsBeforeEdit ?? []
    const newText = result.text
    const node = ctx.graph.getNode(result.nodeId)
    const newRuns = node ? structuredClone(node.styleRuns) : []
    ctx.graph.updateNode(result.nodeId, { text: newText, styleRuns: newRuns })
    ctx.state.editingTextId = null
    textBeforeEdit = null
    styleRunsBeforeEdit = null

    const textChanged = prevText !== newText
    const runsChanged = JSON.stringify(prevRuns) !== JSON.stringify(newRuns)
    if (textChanged || runsChanged) {
      ctx.undo.push({
        label: 'Edit text',
        forward: () => {
          ctx.graph.updateNode(result.nodeId, { text: newText, styleRuns: newRuns })
        },
        inverse: () => {
          ctx.graph.updateNode(result.nodeId, { text: prevText, styleRuns: prevRuns })
        }
      })
    }
  }

  return { startTextEditing, commitTextEdit }
}
