import { computed } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import {
  STATUS_NODE_TYPES,
  statusPlacement,
  type StatusState
} from '@open-pencil/scene-graph/statuses'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'

import { useEditorStore } from '@/app/editor/active-store'

/** A status stored on the layer that its place hides, and the layer that hides it. */
export interface HiddenStatus {
  state: StatusState | undefined
  inside: SceneNode | undefined
}

/**
 * The status of the selected layers that can carry one, sections, frames, components, sets and
 * instances, and the commands the Status section and the canvas status menu share.
 */
export function useSelectedStatuses() {
  const store = useEditorStore()

  const targets = useSceneComputed(() =>
    [...store.state.selectedIds].flatMap((id) => {
      const node = store.graph.getNode(id)
      return node && STATUS_NODE_TYPES.has(node.type) ? [node] : []
    })
  )
  const workflow = useSceneComputed(() => store.statusWorkflow())
  const shown = useSceneComputed(() =>
    targets.value.flatMap((node) => {
      const state = store.getShownStatus(node.id)
      return state ? [state] : []
    })
  )
  const eligible = useSceneComputed(() =>
    targets.value.filter((node) => statusPlacement(store.graph, node) === 'ok')
  )

  /** The state every target shows, '' when they differ or have none. */
  const stateId = computed(() => {
    const ids = new Set(shown.value.map((state) => state.id))
    return shown.value.length === targets.value.length && ids.size === 1 ? [...ids][0] : ''
  })
  const state = computed(() => (stateId.value ? shown.value[0] : undefined))
  const mixed = computed(() => shown.value.length > 0 && stateId.value === '')

  const hidden = useSceneComputed<HiddenStatus | null>(() => {
    const node = targets.value.at(0)
    if (targets.value.length !== 1 || !node?.status || shown.value.length > 0) return null
    // Either a section around it shows its own status, or it sits inside a frame or a group.
    const parentId = node.parentId ?? ''
    const inside =
      statusPlacement(store.graph, node) === 'ancestor'
        ? store.graph.closest(parentId, (ancestor) => store.getShownStatus(ancestor.id) !== null)
        : store.graph.getNode(parentId)
    return { state: workflow.value.states.find((entry) => entry.id === node.status), inside }
  })

  function setState(id: string) {
    store.setStatus(
      eligible.value.map((node) => node.id),
      id
    )
  }

  function remove() {
    store.setStatus(
      targets.value.map((node) => node.id),
      null
    )
  }

  return { targets, eligible, workflow, state, stateId, mixed, hidden, setState, remove }
}
