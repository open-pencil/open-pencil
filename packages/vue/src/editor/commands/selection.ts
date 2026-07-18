import type { SceneNode } from '@open-pencil/scene-graph'

import type { EditorCommandMapOptions } from './context'
import type { EditorCommand, EditorCommandId } from './types'

type SelectionCommandId = Extract<EditorCommandId, `selection.${string}`>

function selectedMaskTarget(nodes: SceneNode[], editor: EditorCommandMapOptions['editor']) {
  if (nodes.length === 0) return null
  if (nodes.length === 1) return nodes[0]

  const [first] = nodes
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const selectedParents = new Set(nodes.map((node) => node.parentId))
  if (selectedParents.size !== 1) return first
  const parentId = first.parentId
  if (!parentId) return first

  for (const sibling of editor.graph.getChildren(parentId)) {
    const selected = byId.get(sibling.id)
    if (selected) return selected
  }
  return first
}

export function createSelectionCommands({
  editor,
  selection,
  capabilities,
  messages: t,
  otherPages,
  moveSelectionToPage,
  getOpacityTarget
}: EditorCommandMapOptions): Record<SelectionCommandId, EditorCommand> {
  return {
    'selection.selectAll': {
      id: 'selection.selectAll',
      get label() {
        return t.value.selectAll
      },
      enabled: capabilities.canSelectAll,
      run: () => editor.selectAll()
    },
    'selection.duplicate': {
      id: 'selection.duplicate',
      get label() {
        return t.value.duplicate
      },
      enabled: capabilities.canDuplicate,
      run: () => editor.duplicateSelected()
    },
    'selection.delete': {
      id: 'selection.delete',
      get label() {
        return t.value.delete
      },
      enabled: capabilities.canDelete,
      run: () => editor.deleteSelected()
    },
    'selection.group': {
      id: 'selection.group',
      get label() {
        return t.value.groupSelection
      },
      enabled: capabilities.canGroup,
      run: () => editor.groupSelected()
    },
    'selection.frameSelection': {
      id: 'selection.frameSelection',
      get label() {
        return t.value.frameSelection
      },
      enabled: capabilities.canFrameSelection,
      run: () => editor.frameSelection()
    },
    'selection.ungroup': {
      id: 'selection.ungroup',
      get label() {
        return t.value.ungroup
      },
      enabled: capabilities.canUngroup,
      run: () => editor.ungroupSelected()
    },
    'selection.createComponent': {
      id: 'selection.createComponent',
      get label() {
        return t.value.createComponent
      },
      enabled: capabilities.canCreateComponent,
      run: () => editor.createComponentFromSelection()
    },
    'selection.createComponentSet': {
      id: 'selection.createComponentSet',
      get label() {
        return t.value.createComponentSet
      },
      enabled: capabilities.canCreateComponentSet,
      run: () => editor.createComponentSetFromComponents()
    },
    'selection.createInstance': {
      id: 'selection.createInstance',
      get label() {
        return t.value.createInstance
      },
      enabled: capabilities.canCreateInstance,
      run: () => {
        const node = selection.selectedNode.value
        if (node?.type === 'COMPONENT') editor.createInstanceFromComponent(node.id)
      }
    },
    'selection.detachInstance': {
      id: 'selection.detachInstance',
      get label() {
        return t.value.detachInstance
      },
      enabled: capabilities.canDetachInstance,
      run: () => editor.detachInstance()
    },
    'selection.goToMainComponent': {
      id: 'selection.goToMainComponent',
      get label() {
        return t.value.goToMainComponent
      },
      enabled: capabilities.canGoToMainComponent,
      run: () => editor.goToMainComponent()
    },
    'selection.wrapInAutoLayout': {
      id: 'selection.wrapInAutoLayout',
      get label() {
        return t.value.addAutoLayout
      },
      enabled: capabilities.canWrapInAutoLayout,
      run: () => editor.wrapInAutoLayout()
    },
    'selection.toggleMask': {
      id: 'selection.toggleMask',
      get label() {
        const target = selectedMaskTarget(editor.getSelectedNodes(), editor)
        return target?.isMask ? t.value.removeMask : t.value.useAsMask
      },
      enabled: capabilities.canToggleMask,
      run: () => {
        const target = selectedMaskTarget(editor.getSelectedNodes(), editor)
        if (!target) return
        editor.updateNodeWithUndo(
          target.id,
          { isMask: !target.isMask },
          target.isMask ? 'Remove mask' : 'Use as mask'
        )
      }
    },
    'selection.bringToFront': {
      id: 'selection.bringToFront',
      get label() {
        return t.value.bringToFront
      },
      enabled: capabilities.canBringToFront,
      run: () => editor.bringToFront()
    },
    'selection.sendToBack': {
      id: 'selection.sendToBack',
      get label() {
        return t.value.sendToBack
      },
      enabled: capabilities.canSendToBack,
      run: () => editor.sendToBack()
    },
    'selection.toggleVisibility': {
      id: 'selection.toggleVisibility',
      get label() {
        return t.value.showHide
      },
      enabled: capabilities.canToggleVisibility,
      run: () => editor.toggleVisibility()
    },
    'selection.toggleLock': {
      id: 'selection.toggleLock',
      get label() {
        return t.value.lockUnlock
      },
      enabled: capabilities.canToggleLock,
      run: () => editor.toggleLock()
    },
    'selection.flipHorizontal': {
      id: 'selection.flipHorizontal',
      get label() {
        return t.value.flipHorizontal
      },
      enabled: capabilities.canFlip,
      run: () => editor.flipNodes([...selection.selectedIds.value], 'horizontal')
    },
    'selection.flipVertical': {
      id: 'selection.flipVertical',
      get label() {
        return t.value.flipVertical
      },
      enabled: capabilities.canFlip,
      run: () => editor.flipNodes([...selection.selectedIds.value], 'vertical')
    },
    'selection.booleanUnion': {
      id: 'selection.booleanUnion',
      get label() {
        return t.value.unionSelection
      },
      enabled: capabilities.canBooleanOperation,
      run: () => editor.booleanOperationSelected('UNION')
    },
    'selection.booleanSubtract': {
      id: 'selection.booleanSubtract',
      get label() {
        return t.value.subtractSelection
      },
      enabled: capabilities.canBooleanOperation,
      run: () => editor.booleanOperationSelected('SUBTRACT')
    },
    'selection.booleanIntersect': {
      id: 'selection.booleanIntersect',
      get label() {
        return t.value.intersectSelection
      },
      enabled: capabilities.canBooleanOperation,
      run: () => editor.booleanOperationSelected('INTERSECT')
    },
    'selection.booleanExclude': {
      id: 'selection.booleanExclude',
      get label() {
        return t.value.excludeSelection
      },
      enabled: capabilities.canBooleanOperation,
      run: () => editor.booleanOperationSelected('EXCLUDE')
    },
    'selection.flatten': {
      id: 'selection.flatten',
      get label() {
        return t.value.flattenSelection
      },
      enabled: capabilities.canFlatten,
      run: () => editor.flattenSelected()
    },
    'selection.outlineText': {
      id: 'selection.outlineText',
      get label() {
        return t.value.outlineText
      },
      enabled: capabilities.canOutlineText,
      run: () => editor.outlineTextSelected()
    },
    'selection.outlineStroke': {
      id: 'selection.outlineStroke',
      get label() {
        return t.value.outlineStroke
      },
      enabled: capabilities.canOutlineStroke,
      run: () => editor.outlineStrokeSelected()
    },
    'selection.moveToPage': {
      id: 'selection.moveToPage',
      get label() {
        return t.value.moveToPage
      },
      enabled: capabilities.canMoveToPage,
      run: () => {
        moveSelectionToPage(otherPages.value[0].id)
      }
    },
    'selection.setOpacity': {
      id: 'selection.setOpacity',
      get label() {
        return t.value.setOpacity
      },
      enabled: capabilities.canSetOpacity,
      run: () => {
        const target = getOpacityTarget()
        editor.setOpacity(target.value, target.coalesceKey)
      }
    }
  }
}
