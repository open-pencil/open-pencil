<script setup lang="ts">
import { computed } from 'vue'

import type { Easing } from '@open-pencil/scene-graph'
import {
  SLIDE_TRANSITION_KINDS,
  transitionDirection,
  transitionKind,
  transitionStyle,
  type MotionDirection,
  type SlideTransition,
  type SlideTransitionKind
} from '@open-pencil/scene-graph/slides'
import { bindMotion, motionControl, setMotion } from '@open-pencil/vue/controls/motion'
import { useMessages } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import MotionFields from '@/components/inputs/MotionFields.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import AnimateDirection from './AnimateDirection.vue'

/** How the slides move on to the next one: the first slide's transition, set on all of them. */
const { slideIds, transition } = defineProps<{
  slideIds: readonly string[]
  transition: SlideTransition | null
}>()

const store = useEditorStore()
const messages = useMessages('slides')

const motion = computed(() => (transition ? motionControl(store.graph, transition) : null))

function edit(change: (current: SlideTransition) => SlideTransition) {
  store.setSlideTransition(slideIds, change)
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
  get: () => (transition ? transitionKind(transition.style) : 'NONE'),
  set: (next: SlideTransitionKind) =>
    edit((current) => ({
      ...current,
      style: transitionStyle(next, transitionDirection(current.style) ?? 'LEFT')
    }))
})
const direction = computed(() => (transition ? transitionDirection(transition.style) : null))
function setDirection(next: MotionDirection) {
  edit((current) => ({ ...current, style: transitionStyle(transitionKind(current.style), next) }))
}

const timing = computed({
  get: () => transition?.timing.type ?? 'ON_CLICK',
  set: (type: string) =>
    edit((current) => ({
      ...current,
      timing: type === 'AFTER_DELAY' ? { type: 'AFTER_DELAY', delay: 1 } : { type: 'ON_CLICK' }
    }))
})
const timingOptions = computed(() => [
  { value: 'ON_CLICK', label: messages.value.onClick },
  { value: 'AFTER_DELAY', label: messages.value.afterDelay }
])
const delayMs = computed(() =>
  transition?.timing.type === 'AFTER_DELAY' ? Math.round(transition.timing.delay * 1000) : 0
)
function setDelay(ms: number) {
  edit((current) => ({
    ...current,
    timing: { type: 'AFTER_DELAY', delay: Math.max(0, ms) / 1000 }
  }))
}

type MotionPatch = { duration?: number; easing?: Easing }
</script>

<template>
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
        @click="edit((current) => current)"
      >
        <icon-lucide-plus class="size-3.5" />
      </IconButton>
    </template>
    <div v-if="transition && motion" class="flex flex-col gap-2">
      <PanelFieldGroup :label="messages.transitionStyle">
        <AppSelect
          v-model="kind"
          :label="messages.transitionStyle"
          :options="kindOptions"
          data-property="animate-transition-style"
        />
      </PanelFieldGroup>
      <PanelFieldGroup v-if="direction" :label="messages.direction">
        <AnimateDirection
          :direction="direction"
          name="animate-transition-direction"
          @update="setDirection"
        />
      </PanelFieldGroup>
      <PanelFieldGroup v-if="kind !== 'NONE'" :label="messages.durationAndEasing">
        <div class="flex flex-col gap-1.5">
          <MotionFields
            :motion="motion"
            :duration-label="messages.duration"
            :easing-label="messages.easing"
            name="animate-transition"
            @set="(patch: MotionPatch) => edit((current) => setMotion(current, patch))"
            @bind="
              (field, variableId) =>
                edit((current) => bindMotion(store.graph, current, field, variableId))
            "
          />
        </div>
      </PanelFieldGroup>
      <PanelFieldGroup :label="messages.timing">
        <div class="flex flex-col gap-1.5">
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
      </PanelFieldGroup>
    </div>
  </PanelSection>
</template>
