import type { EditorContext } from '#core/editor/types'

import { createVectorEditHandleActions } from './handles/actions'
import { createVectorEditHistoryActions } from './history'
import { createVectorEditLifecycle } from './lifecycle'
import { createVectorEditNetworkActions, getLiveNetwork, setNodeEditNetwork } from './network'
import { createVectorEditSelectionActions } from './selection'
import type { VectorEditActionDeps } from './types'

/**
 * Vector edit mode: a VECTOR layer's path edited point by point, with its own undo history,
 * committed to the document as one undo step when the session ends.
 */
export function createVectorEditActions(ctx: EditorContext, actions: VectorEditActionDeps) {
  const { getNodeEditState, commitNodeEditChanges, enterNodeEditMode, exitNodeEditMode } =
    createVectorEditLifecycle(ctx, actions)
  const {
    nodeEditSelectVertex,
    nodeEditAlignVertices,
    nodeEditDeleteSelected,
    nodeEditBreakAtVertex
  } = createVectorEditSelectionActions(ctx, actions, exitNodeEditMode)

  const { nodeEditSetHandle, nodeEditBendHandle, nodeEditZeroVertexHandles } =
    createVectorEditHandleActions(ctx, getNodeEditState)
  const { nodeEditPushHistory, nodeEditUndo, nodeEditRedo } = createVectorEditHistoryActions(ctx)
  const { nodeEditConnectEndpoints, nodeEditAddVertex, nodeEditRemoveVertex } =
    createVectorEditNetworkActions(ctx, getNodeEditState)

  function cancelNodeEditDrag() {
    const editState = getNodeEditState()
    if (!editState) return
    const previous = editState.history.at(-1)
    if (!previous) return
    setNodeEditNetwork(editState, previous)
    editState.history.pop()
    ctx.requestRender()
  }

  return {
    getNodeEditState,
    setNodeEditNetwork,
    getLiveNetwork,
    commitNodeEditChanges: () => {
      const editState = getNodeEditState()
      if (editState) commitNodeEditChanges(editState)
    },
    nodeEditCancelDrag: () => {
      const editState = getNodeEditState()
      if (editState) cancelNodeEditDrag()
    },
    enterNodeEditMode,
    exitNodeEditMode,
    nodeEditSelectVertex,
    nodeEditSetHandle,
    nodeEditBendHandle,
    nodeEditZeroVertexHandles,
    nodeEditConnectEndpoints,
    nodeEditAddVertex,
    nodeEditRemoveVertex,
    nodeEditAlignVertices,
    nodeEditDeleteSelected,
    nodeEditBreakAtVertex,
    nodeEditPushHistory,
    nodeEditUndo,
    nodeEditRedo
  }
}
