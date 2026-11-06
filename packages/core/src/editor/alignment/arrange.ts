import { recordEdit } from '#core/editor/history/edit'
import type { EditorContext } from '#core/editor/types'
import {
  arrangeLayers,
  arrangeProblem,
  type ArrangeLayersOptions,
  type LayerArrangement
} from '#core/layout/arrange/layers'

export function createArrangeActions(ctx: EditorContext) {
  /**
   * Arranges layers with one of ELK's layouts, along the connectors joining them, as one undo
   * step that also covers the sections it resizes and the connectors it reroutes. Only the moves
   * made once the layout has finished are recorded, so edits made while it runs stay their own.
   * Rejects, having moved nothing, when the layers cannot be arranged together or change while
   * the layout runs.
   */
  async function arrangeNodes(
    nodeIds: string[],
    options: ArrangeLayersOptions
  ): Promise<LayerArrangement> {
    const graph = ctx.graph
    try {
      return await arrangeLayers(graph, nodeIds, options, (apply) => {
        // Another document may have replaced this one while the layout ran.
        if (ctx.graph !== graph) {
          throw new Error('The document changed while the layers were being arranged')
        }
        // The moves land after the layout's await, so any batch open now is another edit's.
        recordEdit(ctx, { label: 'Arrange', ownStep: true }, apply)
      })
    } finally {
      ctx.requestRender()
    }
  }

  /** Whether ELK's layouts take these layers: they must share a parent, but for chosen sections. */
  function canAutoArrangeNodes(nodeIds: string[]): boolean {
    return arrangeProblem(ctx.graph, nodeIds, 'spread') === null
  }

  return { arrangeNodes, canAutoArrangeNodes }
}
