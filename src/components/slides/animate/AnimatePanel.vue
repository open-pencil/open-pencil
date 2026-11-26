<script setup lang="ts">
import { computed } from 'vue'

import type { Easing, SceneNode } from '@open-pencil/scene-graph'
import {
  animatedLayers,
  layerAnimationDirection,
  layerAnimationStyle,
  MOTION_DIRECTIONS,
  SLIDE_TRANSITION_KINDS,
  slideSettings,
  transitionDirection,
  transitionKind,
  transitionStyle,
  type LayerAnimation,
  type MotionDirection,
  type SlideTransition,
  type SlideTransitionKind
} from '@open-pencil/scene-graph/slides'
import { bindMotion, motionControl, setMotion } from '@open-pencil/vue/controls/motion'
import { useMessages } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'

import { useEditorStore } from '@/app/editor/active-store'
import MotionFields from '@/components/inputs/MotionFields.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

import AnimateDirection from './AnimateDirection.vue'

/**
 * How a deck moves: the transition of the slides being worked on, and the steps of the slide's
 * build, each a layer coming on or going off on a click or after the step before.
 */
const store = useEditorStore()
const messages = useMessages('slides')

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
const transitionMotion = computed(() =>
  transition.value ? motionControl(store.graph, transition.value) : null
)

function editTransition(change: (current: SlideTransition) => SlideTransition) {
  store.setSlideTransition(slideIds.value, change)
}

const kindLabels = computed<Record<SlideTransitionKind, string>>(() => ({
  NONE: messages.value.kindNone,
  SMART_ANIMATE: messages.value.kindSmartAnimate,
  DISSOLVE: messages.value.kindDissolve,
  PUSH: messages.value.kindPush,
  SLIDE_IN: messages.value.kindSlideIn,
  SLIDE_OUT: messages.value.kindSlideOut,
  MOVE_IN: messages.value.kindMoveIn,
  MOVE_OUT: messages.value.kindMoveOut
}))
const kindOptions = computed(() =>
  SLIDE_TRANSITION_KINDS.map((kind) => ({ value: kind, label: kindLabels.value[kind] }))
)
const kind = computed({
  get: () => (transition.value ? transitionKind(transition.value.style) : 'NONE'),
  set: (next: SlideTransitionKind) =>
    editTransition((current) => ({
      ...current,
      style: transitionStyle(next, transitionDirection(current.style) ?? 'LEFT')
    }))
})
const direction = computed(() =>
  transition.value ? transitionDirection(transition.value.style) : null
)
function setDirection(next: MotionDirection) {
  editTransition((current) => ({
    ...current,
    style: transitionStyle(transitionKind(current.style), next)
  }))
}

const timing = computed({
  get: () => transition.value?.timing.type ?? 'ON_CLICK',
  set: (type: string) =>
    editTransition((current) => ({
      ...current,
      timing: type === 'AFTER_DELAY' ? { type: 'AFTER_DELAY', delay: 1 } : { type: 'ON_CLICK' }
    }))
})
const timingOptions = computed(() => [
  { value: 'ON_CLICK', label: messages.value.onClick },
  { value: 'AFTER_DELAY', label: messages.value.afterDelay }
])
const delayMs = computed(() => {
  const timingValue = transition.value?.timing
  return timingValue?.type === 'AFTER_DELAY' ? Math.round(timingValue.delay * 1000) : 0
})
function setDelay(ms: number) {
  editTransition((current) => ({
    ...current,
    timing: { type: 'AFTER_DELAY', delay: Math.max(0, ms) / 1000 }
  }))
}

/** The slide whose build the list shows: the first of those the transition applies to. */
const slide = computed(() => slides.value.at(0) ?? null)
const layers = useSceneComputed(() =>
  slide.value
    ? animatedLayers(store.graph, slide.value.id).map(({ id, animation }) => ({
        id,
        animation,
        name: store.graph.getNode(id)?.name ?? ''
      }))
    : []
)
/** Selected layers on the slide that have no animation yet. */
const addable = computed(() =>
  [...store.state.selectedIds].filter((id) => {
    const node = store.graph.getNode(id)
    return node && node.type !== 'SLIDE' && !node.animation && slide.value
      ? store.graph.isDescendant(id, slide.value.id)
      : false
  })
)
/** The animation the panel edits: the one of the only selected layer. */
const editing = computed(() => {
  const [only, ...rest] = store.state.selectedIds
  return rest.length === 0 ? layers.value.find((layer) => layer.id === only) : undefined
})
const editingMotion = computed(() =>
  editing.value ? motionControl(store.graph, editing.value.animation) : null
)

function editAnimation(change: (current: LayerAnimation) => LayerAnimation) {
  if (editing.value) store.setLayerAnimations([editing.value.id], change)
}

const layerStyleOptions = computed(() => [
  { value: 'FADE', label: messages.value.fade },
  { value: 'LEFT', label: messages.value.slideLeft },
  { value: 'RIGHT', label: messages.value.slideRight },
  { value: 'UP', label: messages.value.slideUp },
  { value: 'DOWN', label: messages.value.slideDown }
])
const layerStyle = computed({
  get: () =>
    editing.value ? (layerAnimationDirection(editing.value.animation.style) ?? 'FADE') : 'FADE',
  set: (value: string) =>
    editAnimation((current) => ({
      ...current,
      style: layerAnimationStyle(MOTION_DIRECTIONS.find((candidate) => candidate === value) ?? null)
    }))
})
const phaseOptions = computed(() => [
  { value: 'IN', label: messages.value.phaseIn },
  { value: 'OUT', label: messages.value.phaseOut }
])
const phase = computed({
  get: () => editing.value?.animation.phase ?? 'IN',
  set: (value: string) =>
    editAnimation((current) => ({ ...current, phase: value === 'OUT' ? 'OUT' : 'IN' }))
})
const triggerOptions = computed(() => [
  { value: 'ON_CLICK', label: messages.value.onClick },
  { value: 'AFTER_PREVIOUS', label: messages.value.afterPrevious }
])
const trigger = computed({
  get: () => editing.value?.animation.trigger ?? 'ON_CLICK',
  set: (value: string) =>
    editAnimation((current) => ({
      ...current,
      trigger: value === 'AFTER_PREVIOUS' ? 'AFTER_PREVIOUS' : 'ON_CLICK'
    }))
})

function summary(animation: LayerAnimation): string {
  const seconds = `${Number(animation.duration.toFixed(2))}s`
  const phaseLabel = animation.phase === 'IN' ? messages.value.phaseIn : messages.value.phaseOut
  return `${seconds} · ${phaseLabel}`
}

type MotionPatch = { duration?: number; easing?: Easing }
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto" data-test-id="animate-panel">
    <p v-if="!slide" class="px-3 py-6 text-center text-2xs text-muted">
      {{ messages.pickSlide }}
    </p>
    <template v-else>
      <PanelSection :label="messages.slideTransition" data-test-id="animate-transition">
        <template #actions>
          <IconButton
            v-if="transition"
            :label="messages.removeTransition"
            data-test-id="animate-remove-transition"
            @click="store.setSlideTransition(slideIds, null)"
          >
            <icon-lucide-minus class="size-3.5" />
          </IconButton>
          <IconButton
            v-else
            :label="messages.addTransition"
            data-test-id="animate-add-transition"
            @click="editTransition((current) => current)"
          >
            <icon-lucide-plus class="size-3.5" />
          </IconButton>
        </template>
        <div v-if="transition && transitionMotion" class="flex flex-col gap-1.5">
          <AppSelect
            v-model="kind"
            :label="messages.transitionStyle"
            :options="kindOptions"
            data-property="animate-transition-style"
          />
          <AnimateDirection
            v-if="direction"
            :direction="direction"
            data-property="animate-transition-direction"
            @update="setDirection"
          />
          <MotionFields
            v-if="kind !== 'NONE'"
            :motion="transitionMotion"
            :duration-label="messages.duration"
            :easing-label="messages.easing"
            name="animate-transition"
            @set="(patch: MotionPatch) => editTransition((current) => setMotion(current, patch))"
            @bind="
              (field, variableId) =>
                editTransition((current) => bindMotion(store.graph, current, field, variableId))
            "
          />
          <AppSelect
            v-model="timing"
            :label="messages.timing"
            :options="timingOptions"
            data-property="animate-transition-timing"
          />
          <NumberField
            v-if="timing === 'AFTER_DELAY'"
            :model-value="delayMs"
            :min="0"
            :step="100"
            suffix="ms"
            :aria-label="messages.delay"
            data-property="animate-transition-delay"
            @commit="setDelay"
          >
            <template #icon><icon-lucide-timer class="size-3.5" /></template>
          </NumberField>
        </div>
      </PanelSection>

      <PanelSection :label="messages.animations" data-test-id="animate-animations">
        <template #actions>
          <IconButton
            :label="messages.addAnimation"
            :disabled="addable.length === 0"
            data-test-id="animate-add-animation"
            @click="store.addLayerAnimations(addable)"
          >
            <icon-lucide-plus class="size-3.5" />
          </IconButton>
        </template>
        <p v-if="layers.length === 0" class="text-2xs text-muted">{{ messages.noAnimations }}</p>
        <ol v-else class="flex flex-col gap-1">
          <li v-for="(layer, index) in layers" :key="layer.id">
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded px-1.5 py-1 text-start text-xs hover:bg-hover aria-pressed:bg-accent/15"
              :aria-pressed="editing?.id === layer.id"
              data-test-id="animate-step"
              @click="store.select([layer.id])"
            >
              <span class="w-4 shrink-0 text-end text-3xs text-muted tabular-nums">
                {{ index + 1 }}
              </span>
              <span class="min-w-0 flex-1 truncate">{{ layer.name }}</span>
              <span class="shrink-0 text-2xs text-muted">{{ summary(layer.animation) }}</span>
            </button>
          </li>
        </ol>
        <div v-if="editing && editingMotion" class="mt-2 flex flex-col gap-1.5">
          <AppSelect
            v-model="layerStyle"
            :label="messages.transitionStyle"
            :options="layerStyleOptions"
            data-property="animate-layer-style"
          />
          <MotionFields
            :motion="editingMotion"
            :duration-label="messages.duration"
            :easing-label="messages.easing"
            name="animate-layer"
            @set="(patch: MotionPatch) => editAnimation((current) => setMotion(current, patch))"
            @bind="
              (field, variableId) =>
                editAnimation((current) => bindMotion(store.graph, current, field, variableId))
            "
          />
          <AppSelect
            v-model="trigger"
            :label="messages.timing"
            :options="triggerOptions"
            data-property="animate-layer-trigger"
          />
          <SegmentedControl v-model="phase" :options="phaseOptions" :label="messages.phase" />
          <div class="flex items-center justify-end gap-1">
            <IconButton
              :label="messages.moveEarlier"
              :disabled="layers[0]?.id === editing.id"
              @click="store.moveLayerAnimation(editing.id, layers.indexOf(editing) - 1)"
            >
              <icon-lucide-arrow-up class="size-3.5" />
            </IconButton>
            <IconButton
              :label="messages.moveLater"
              :disabled="layers.at(-1)?.id === editing.id"
              @click="store.moveLayerAnimation(editing.id, layers.indexOf(editing) + 1)"
            >
              <icon-lucide-arrow-down class="size-3.5" />
            </IconButton>
            <IconButton
              :label="messages.removeAnimation"
              data-test-id="animate-remove-animation"
              @click="store.removeLayerAnimations([editing.id])"
            >
              <icon-lucide-trash-2 class="size-3.5" />
            </IconButton>
          </div>
        </div>
      </PanelSection>
    </template>
  </div>
</template>
