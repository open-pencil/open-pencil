import type { EditorContext } from '#core/editor/types'

export function createFlipRotateActions(ctx: EditorContext) {
  function flipNodes(nodeIds: string[], axis: 'horizontal' | 'vertical') {
    if (nodeIds.length === 0) return

    const originals = new Map<string, { flipX: boolean; flipY: boolean }>()
    for (const id of nodeIds) {
      const node = ctx.graph.getNode(id)
      if (!node) continue
      originals.set(id, { flipX: node.flipX, flipY: node.flipY })
      const changes = axis === 'horizontal' ? { flipX: !node.flipX } : { flipY: !node.flipY }
      ctx.graph.updateNode(id, changes)
    }

    const finals = new Map<string, { flipX: boolean; flipY: boolean }>()
    for (const [id] of originals) {
      const node = ctx.graph.getNode(id)
      if (node) finals.set(id, { flipX: node.flipX, flipY: node.flipY })
    }

    ctx.undo.push({
      label: 'Flip',
      forward: () => {
        for (const [id, val] of finals) ctx.graph.updateNode(id, val)
      },
      inverse: () => {
        for (const [id, val] of originals) ctx.graph.updateNode(id, val)
      }
    })

    ctx.requestRender()
  }

  function rotateNodes(nodeIds: string[], degrees: number) {
    if (nodeIds.length === 0) return

    const originals = new Map<string, number>()
    for (const id of nodeIds) {
      const node = ctx.graph.getNode(id)
      if (!node) continue
      originals.set(id, node.rotation)
      ctx.graph.updateNode(id, { rotation: (((node.rotation + degrees) % 360) + 360) % 360 })
    }

    const finals = new Map<string, number>()
    for (const [id] of originals) {
      const node = ctx.graph.getNode(id)
      if (node) finals.set(id, node.rotation)
    }

    ctx.undo.push({
      label: 'Rotate',
      forward: () => {
        for (const [id, rot] of finals) ctx.graph.updateNode(id, { rotation: rot })
      },
      inverse: () => {
        for (const [id, rot] of originals) ctx.graph.updateNode(id, { rotation: rot })
      }
    })

    ctx.requestRender()
  }

  return { flipNodes, rotateNodes }
}
