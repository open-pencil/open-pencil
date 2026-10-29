import { computed } from 'vue'

import type { SceneNode, SharedStyleKind } from '@open-pencil/scene-graph'
import {
  getSharedStyles,
  sharedStyleRefKey,
  sharedStyleTypeForKind
} from '@open-pencil/scene-graph/shared-styles'

import { useNodeProps } from '#vue/controls/node-props/use'
import { sharedStyleDetachPatch, sharedStylePatch } from '#vue/controls/shared-style/model'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

function supportsStyle(node: SceneNode, kind: SharedStyleKind): boolean {
  if (kind === 'text') return node.type === 'TEXT'
  if (kind === 'grid') {
    return (
      node.type === 'FRAME' ||
      node.type === 'COMPONENT' ||
      node.type === 'COMPONENT_SET' ||
      node.type === 'INSTANCE'
    )
  }
  return node.type !== 'CANVAS'
}

export function useSharedStyleBinding(kind: SharedStyleKind) {
  const { store, nodes, merged } = useNodeProps()
  const refKey = sharedStyleRefKey(kind)
  const active = computed(
    () => nodes.value.length > 0 && nodes.value.every((node) => supportsStyle(node, kind))
  )
  const styleId = computed(() => merged(refKey))
  const styles = useSceneComputed(() => {
    void store.state.sceneVersion
    return getSharedStyles(store.graph, kind)
  })

  function update(label: string, apply: (node: SceneNode) => Partial<SceneNode>) {
    if (!active.value) return
    const targets = nodes.value
    const run = () => {
      for (const node of targets) store.updateNodeWithUndo(node.id, apply(node), label)
    }
    if (targets.length > 1) store.undo.runBatch(label, run)
    else run()
  }

  function bind(nextStyleId: string) {
    const styleInfo = styles.value.find((style) => style.id === nextStyleId)
    const styleNode = styleInfo ? (store.graph.getNode(styleInfo.nodeId) ?? null) : null
    if (styleNode?.sharedStyleType !== sharedStyleTypeForKind(kind)) return
    update(`Apply ${kind} style`, (node) => sharedStylePatch(kind, node, nextStyleId, styleNode))
  }

  function unbind() {
    update(`Detach ${kind} style`, () => sharedStyleDetachPatch(kind))
  }

  return { kind, active, styleId, styles, bind, unbind }
}
