import type { EditorContext } from './types'

export function createVariableBindingActions(ctx: EditorContext) {
  function bindVariable(nodeId: string, path: string, variableId: string) {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const prevVarId = node.boundVariables[path]
    ctx.graph.bindVariable(nodeId, path, variableId)
    ctx.undo.push({
      label: 'Bind variable',
      forward: () => {
        try {
          ctx.graph.bindVariable(nodeId, path, variableId)
          ctx.requestRender()
        } catch (e) {
          console.warn('Redo bindVariable failed:', e instanceof Error ? e.message : String(e))
        }
      },
      inverse: () => {
        try {
          if (prevVarId) ctx.graph.bindVariable(nodeId, path, prevVarId)
          else ctx.graph.unbindVariable(nodeId, path)
          ctx.requestRender()
        } catch (e) {
          console.warn('Undo bindVariable failed:', e instanceof Error ? e.message : String(e))
        }
      }
    })
    ctx.requestRender()
  }

  function unbindVariable(nodeId: string, path: string) {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const prevVarId = node.boundVariables[path]
    if (!prevVarId) return
    ctx.graph.unbindVariable(nodeId, path)
    ctx.undo.push({
      label: 'Unbind variable',
      forward: () => {
        try {
          ctx.graph.unbindVariable(nodeId, path)
          ctx.requestRender()
        } catch (e) {
          console.warn('Redo unbindVariable failed:', e instanceof Error ? e.message : String(e))
        }
      },
      inverse: () => {
        try {
          ctx.graph.bindVariable(nodeId, path, prevVarId)
          ctx.requestRender()
        } catch (e) {
          console.warn('Undo unbindVariable failed:', e instanceof Error ? e.message : String(e))
        }
      }
    })
    ctx.requestRender()
  }

  return { bindVariable, unbindVariable }
}
