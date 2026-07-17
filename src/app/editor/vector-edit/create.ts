import type { Editor } from '@open-pencil/core/editor'

import { createVectorEditHandleActions } from './handle-actions'
import { createVectorEditHistoryActions } from './history'
import { createVectorEditLifecycle } from './lifecycle'
import { createVectorEditNetworkActions, getLiveNetwork, setNodeEditNetwork } from './network'
import { createVectorEditSelectionActions } from './selection'
import type { VectorEditState } from './types'

export function createVectorEditActions(editor: Editor, state: VectorEditState) {
  const { getNodeEditState, applyNodeEditToNode, enterNodeEditMode, exitNodeEditMode } =
    createVectorEditLifecycle(editor, state)
  const {
    nodeEditSelectVertex,
    nodeEditAlignVertices,
    nodeEditDeleteSelected,
    nodeEditBreakAtVertex
  } = createVectorEditSelectionActions(editor, state)

  const { nodeEditSetHandle, nodeEditBendHandle, nodeEditZeroVertexHandles } =
    createVectorEditHandleActions(editor, getNodeEditState)
  const { nodeEditPushHistory, nodeEditUndo, nodeEditRedo } = createVectorEditHistoryActions(
    editor,
    state
  )
  const { nodeEditConnectEndpoints, nodeEditAddVertex, nodeEditRemoveVertex } =
    createVectorEditNetworkActions(editor, state, getNodeEditState)

  return {
    getNodeEditState,
    setNodeEditNetwork,
    getLiveNetwork,
    applyNodeEditToNode,
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
