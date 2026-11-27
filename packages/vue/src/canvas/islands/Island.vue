<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'

import { resolvePlayState } from '@open-pencil/core'
import { vectorElement } from '@open-pencil/core/io'
import { autoLineHeight } from '@open-pencil/core/layout'
import {
  behaviourControls,
  controlRoles,
  sceneNodeToDesignDocument
} from '@open-pencil/dom-css/export'

import { useEditor } from '#vue/editor/context'

import { renderNode } from './render'
import { useShadowContainer } from './shadow'
import { createIslandState, instanceStates } from './state'
import { islandTransitions, useIslandMotion } from './transition'

/**
 * One live island: a top-level layer that holds controls, rendered as DOM in its own shadow
 * root, with each control running as its Reka UI component. The design's variants draw the
 * controls' states; the document never changes.
 */
const { rootId, revision, tokens, faded } = defineProps<{
  rootId: string
  /** Changing it starts every control again as designed. */
  revision: number
  /** The document's variables as custom properties, shared by every island of the canvas. */
  tokens: CSSStyleSheet
  /**
   * Layers drawn fully transparent where they are, as a presentation keeps a layer whose build
   * has not brought it on, or has taken it off, without moving what is around it.
   */
  faded?: ReadonlySet<string>
}>()
const editor = useEditor()

const container = useShadowContainer(useTemplateRef<HTMLElement>('host'), [tokens])

const controls = computed(() => {
  void editor.state.sceneVersion
  return behaviourControls(editor.graph, rootId)
})
const roles = computed(() => controlRoles(controls.value))
const motion = useIslandMotion()
const transitions = computed(() => {
  void editor.state.sceneVersion
  return motion.value ? islandTransitions(editor.graph, rootId, controls.value.values()) : new Map()
})
const state = shallowRef(createIslandState(controls.value))
watch(
  () => [rootId, revision, [...controls.value.keys()].join('\n')],
  () => (state.value = createIslandState(controls.value))
)

const projection = computed(() => {
  void editor.state.sceneVersion
  const graph = resolvePlayState(editor.graph, rootId, instanceStates(controls.value, state.value))
  // The state's graph is a private copy, so fading a layer there leaves the document alone.
  for (const id of faded ?? []) if (graph.getNode(id)) graph.updateNode(id, { opacity: 0 })
  const [root] = sceneNodeToDesignDocument(graph, rootId, {
    vectorElement,
    canvasMetrics: { autoLineHeight }
  }).children
  return { graph, root }
})

/** The island's layers, rendered from the projection of their current states. */
function Layers() {
  const { graph, root } = projection.value
  return root
    ? renderNode(
        {
          graph,
          rootId,
          controls: controls.value,
          roles: roles.value,
          state: state.value,
          transitions: transitions.value
        },
        root,
        ''
      )
    : null
}
</script>

<template>
  <div ref="host" :data-island="rootId">
    <Teleport v-if="container" :to="container">
      <Layers />
    </Teleport>
  </div>
</template>
