import type { SceneNode } from '@open-pencil/scene-graph'
import { deriveSlashVariantProperties } from '@open-pencil/scene-graph/variant-properties'

import { randomHex } from '#core/random'

import { createComponentFocusActions } from './components/focus'
import { createComponentInstanceActions } from './components/instances'
import { createComponentPropertyActions } from './components/properties'
import { createVariantActions } from './components/variants'
import type { EditorContext } from './types'

export function createComponentActions(ctx: EditorContext) {
  function createComponentFromSelection(
    selectedNodes: SceneNode[],
    wrapSelectionInContainer: (
      type: 'GROUP' | 'FRAME' | 'COMPONENT' | 'COMPONENT_SET',
      nodes: SceneNode[],
      extra?: Partial<SceneNode>
    ) => string | null
  ) {
    if (selectedNodes.length === 0) return

    const prevSelection = new Set(ctx.state.selectedIds)

    if (selectedNodes.length === 1) {
      const node = selectedNodes[0]
      const prevType = node.type

      if (node.type === 'COMPONENT') return

      if (node.type === 'FRAME' || node.type === 'GROUP') {
        ctx.graph.updateNode(node.id, { type: 'COMPONENT' })
        ctx.setSelectedIds(new Set([node.id]))
        ctx.undo.push({
          label: 'Create component',
          forward: () => {
            ctx.graph.updateNode(node.id, { type: 'COMPONENT' })
            ctx.setSelectedIds(new Set([node.id]))
          },
          inverse: () => {
            ctx.graph.updateNode(node.id, { type: prevType })
            ctx.setSelectedIds(prevSelection)
          }
        })
        return
      }
    }

    wrapSelectionInContainer('COMPONENT', selectedNodes)
  }

  function createComponentSetFromComponents(
    selectedNodes: SceneNode[],
    wrapSelectionInContainer: (
      type: 'GROUP' | 'FRAME' | 'COMPONENT' | 'COMPONENT_SET',
      nodes: SceneNode[],
      extra?: Partial<SceneNode>
    ) => string | null
  ) {
    if (selectedNodes.length < 2) return
    if (!selectedNodes.every((n) => n.type === 'COMPONENT')) return
    const containerId = wrapSelectionInContainer('COMPONENT_SET', selectedNodes)
    if (!containerId) return

    const derived = deriveSlashVariantProperties(selectedNodes, () => `prop:${randomHex(8)}`)
    if (!derived) return

    for (const [nodeId, changes] of derived.variants) {
      ctx.graph.updateNode(nodeId, changes)
    }
    ctx.graph.updateNode(containerId, { componentPropertyDefinitions: derived.definitions })
  }

  const focusActions = createComponentFocusActions(ctx)
  const instanceActions = createComponentInstanceActions(ctx)
  const variantActions = createVariantActions(ctx)
  const componentPropertyActions = createComponentPropertyActions(
    ctx,
    variantActions.switchInstanceVariant
  )

  return {
    createComponentFromSelection,
    createComponentSetFromComponents,
    ...instanceActions,
    ...focusActions,
    ...variantActions,
    ...componentPropertyActions
  }
}
