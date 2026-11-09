import type { EditorContext } from '#core/editor/types'

import { createVectorEditHandleActions } from './handles/actions'
import { createVectorEditLifecycle } from './lifecycle'
import { createVectorEditNetworkActions, getLiveNetwork, setNodeEditNetwork } from './network'
import { createVectorEditSelectionActions } from './selection'
import type { VectorEditActionDeps } from './types'

/**
 * Vector edit mode: a VECTOR layer's path edited point by point. Opening it, each change, and
 * leaving it are steps of the document's undo history, as in Figma.
 */
export function createVectorEditActions(ctx: EditorContext, actions: VectorEditActionDeps) {
  const { getNodeEditState, commitNodeEditChanges, enterNodeEditMode, exitNodeEditMode, history } =
    createVectorEditLifecycle(ctx, actions)
  const {
    nodeEditSelectVertex,
    nodeEditAlignVertices,
    nodeEditDeleteSelected,
    nodeEditBreakAtVertex
  } = createVectorEditSelectionActions(ctx, actions, exitNodeEditMode, history)

  const { nodeEditSetHandle, nodeEditBendHandle, nodeEditZeroVertexHandles } =
    createVectorEditHandleActions(ctx, getNodeEditState, history)
  const { nodeEditConnectEndpoints, nodeEditAddVertex, nodeEditRemoveVertex } =
    createVectorEditNetworkActions(ctx, getNodeEditState, history)

  return {
    getNodeEditState,
    setNodeEditNetwork,
    getLiveNetwork,
    commitNodeEditChanges: () => {
      const editState = getNodeEditState()
      if (editState) commitNodeEditChanges(editState)
    },
    /** Puts back the path as the change in progress started, for `cancelGesture`; true when one was. */
    cancelNodeEditChange: (): boolean => {
      const editState = getNodeEditState()
      if (!editState?.changeStart) return false
      history.cancel(editState)
      return true
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
    /** Commits the change before and marks where the next one starts, as a press on the path does. */
    nodeEditPushHistory: () => {
      const editState = getNodeEditState()
      if (editState) history.begin(editState)
    }
  }
}
