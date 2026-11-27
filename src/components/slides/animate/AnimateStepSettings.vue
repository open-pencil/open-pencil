<script setup lang="ts">
import { computed } from 'vue'

import type { Easing } from '@open-pencil/scene-graph'
import {
  layerAnimationDirection,
  layerAnimationStyle,
  type LayerAnimation,
  type MotionDirection
} from '@open-pencil/scene-graph/slides'
import { bindMotion, motionControl, setMotion } from '@open-pencil/vue/controls/motion'
import { useMessages } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import MotionFields from '@/components/inputs/MotionFields.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

import AnimateDirection from './AnimateDirection.vue'

/** One step's settings, under its row: how the layer moves, for how long, when, and which way. */
const { layerId, animation } = defineProps<{ layerId: string; animation: LayerAnimation }>()

const store = useEditorStore()
const messages = useMessages('slides')

const motion = computed(() => motionControl(store.graph, animation))
function edit(change: (current: LayerAnimation) => LayerAnimation) {
  store.setLayerAnimations([layerId], change)
}

const direction = computed(() => layerAnimationDirection(animation.style))
const styleOptions = computed(() => [
  { value: 'FADE', label: messages.value.fade },
  { value: 'SLIDE', label: messages.value.slide }
])
const style = computed({
  get: () => (direction.value ? 'SLIDE' : 'FADE'),
  set: (value: string) =>
    edit((current) => ({
      ...current,
      style: layerAnimationStyle(value === 'SLIDE' ? (direction.value ?? 'RIGHT') : null)
    }))
})
function setDirection(next: MotionDirection) {
  edit((current) => ({ ...current, style: layerAnimationStyle(next) }))
}

const triggerOptions = computed(() => [
  { value: 'ON_CLICK', label: messages.value.onClick },
  { value: 'AFTER_PREVIOUS', label: messages.value.afterPrevious }
])
const trigger = computed({
  get: () => animation.trigger,
  set: (value: string) =>
    edit((current) => ({
      ...current,
      trigger: value === 'AFTER_PREVIOUS' ? 'AFTER_PREVIOUS' : 'ON_CLICK'
    }))
})
const phaseOptions = computed(() => [
  { value: 'IN', label: messages.value.phaseIn },
  { value: 'OUT', label: messages.value.phaseOut }
])
const phase = computed({
  get: () => animation.phase,
  set: (value: string) => edit((current) => ({ ...current, phase: value === 'OUT' ? 'OUT' : 'IN' }))
})

type MotionPatch = { duration?: number; easing?: Easing }
</script>

<template>
  <div class="flex flex-col gap-2 py-2" data-slot="animation-settings">
    <PanelFieldGroup :label="messages.phase">
      <SegmentedControl v-model="phase" :options="phaseOptions" :label="messages.phase" />
    </PanelFieldGroup>
    <PanelFieldGroup :label="messages.transitionStyle">
      <AppSelect
        v-model="style"
        :label="messages.transitionStyle"
        :options="styleOptions"
        data-property="animate-layer-style"
      />
    </PanelFieldGroup>
    <PanelFieldGroup v-if="direction" :label="messages.direction">
      <AnimateDirection
        :direction="direction"
        name="animate-layer-direction"
        @update="setDirection"
      />
    </PanelFieldGroup>
    <PanelFieldGroup :label="messages.durationAndEasing">
      <div class="flex flex-col gap-1.5">
        <MotionFields
          :motion="motion"
          :duration-label="messages.duration"
          :easing-label="messages.easing"
          name="animate-layer"
          @set="(patch: MotionPatch) => edit((current) => setMotion(current, patch))"
          @bind="
            (field, variableId) =>
              edit((current) => bindMotion(store.graph, current, field, variableId))
          "
        />
      </div>
    </PanelFieldGroup>
    <PanelFieldGroup :label="messages.start">
      <AppSelect
        v-model="trigger"
        :label="messages.start"
        :options="triggerOptions"
        data-property="animate-layer-trigger"
      />
    </PanelFieldGroup>
  </div>
</template>
