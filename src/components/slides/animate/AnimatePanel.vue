<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import {
  animatedLayers,
  animationSlide,
  animationTarget,
  slideSettings
} from '@open-pencil/scene-graph/slides'
import { useMessages } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'

import { useEditorStore } from '@/app/editor/active-store'
import animateTheme from '@/theme/slides/animate'

import AnimateSteps, { type AnimatedStep } from './AnimateSteps.vue'
import AnimateTransition from './AnimateTransition.vue'

/**
 * How a deck moves: the transition of the slides being worked on, and the steps of the slide's
 * build, each a layer coming on or going off on a click or after the step before.
 */
const store = useEditorStore()
const messages = useMessages('slides')
const ui = tv(animateTheme)()

/** The slides the transition applies to: those selected, else the one on the stage, else the one holding the selection. */
const slides = useSceneComputed<SceneNode[]>(() => {
  const selected = [...store.state.selectedIds].flatMap((id) => {
    const node = store.graph.getNode(id)
    return node?.type === 'SLIDE' ? [node] : []
  })
  if (selected.length > 0) return selected
  const staged = store.state.focusedSlideId && store.graph.getNode(store.state.focusedSlideId)
  if (staged) return [staged]
  for (const id of store.state.selectedIds) {
    const slide = store.graph.closest(id, (node) => node.type === 'SLIDE')
    if (slide) return [slide]
  }
  return []
})
const slideIds = computed(() => slides.value.map((slide) => slide.id))
const transition = computed(() => {
  const first = slides.value.at(0)
  return first ? (slideSettings(first)?.transition ?? null) : null
})

/** The slide whose build the list shows: the first of those the transition applies to. */
const slide = computed(() => slides.value.at(0) ?? null)
const steps = useSceneComputed<AnimatedStep[]>(() =>
  slide.value
    ? animatedLayers(store.graph, slide.value.id).map(({ id, animation }) => ({
        id,
        animation,
        name: store.graph.getNode(id)?.name ?? ''
      }))
    : []
)
/**
 * Selected layers on the slide that can animate and do not yet; a layer inside an instance counts
 * as its instance, which Figma animates instead.
 */
const addable = useSceneComputed(() =>
  [...store.state.selectedIds].flatMap((id) => {
    const target = animationTarget(store.graph, id)
    const node = target ? store.graph.getNode(target) : undefined
    return node &&
      target &&
      !node.animation &&
      animationSlide(store.graph, target)?.id === slide.value?.id
      ? [target]
      : []
  })
)
</script>

<template>
  <div :class="ui.root()" data-test-id="animate-panel">
    <p v-if="!slide" :class="ui.pick()">
      {{ messages.pickSlide }}
    </p>
    <template v-else>
      <AnimateTransition :slide-ids="slideIds" :transition="transition" />
      <AnimateSteps :slide-id="slide.id" :steps="steps" :addable="addable" />
    </template>
  </div>
</template>
