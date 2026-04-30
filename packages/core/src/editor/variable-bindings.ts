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
        ctx.graph.bindVariable(nodeId, path, variableId)
        ctx.requestRender()
      },
      inverse: () => {
        if (prevVarId) ctx.graph.bindVariable(nodeId, path, prevVarId)
        else ctx.graph.unbindVariable(nodeId, path)
        ctx.requestRender()
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
        ctx.graph.unbindVariable(nodeId, path)
        ctx.requestRender()
      },
      inverse: () => {
        ctx.graph.bindVariable(nodeId, path, prevVarId)
        ctx.requestRender()
      }
    })
    ctx.requestRender()
  }

  return { bindVariable, unbindVariable }
}
