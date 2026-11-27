<script setup lang="ts">
import { computed } from 'vue'

import { MOTION_DIRECTIONS, type MotionDirection } from '@open-pencil/scene-graph/slides'
import { useMessages } from '@open-pencil/vue/i18n'

import LeftToRight from '@/components/ui/direction/LeftToRight.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

/** Which way a transition moves the slides, as four arrows, as Figma's panel shows it. */
const { direction } = defineProps<{ direction: MotionDirection }>()
const emit = defineEmits<{ update: [direction: MotionDirection] }>()
const messages = useMessages('slides')

const labels = computed<Record<MotionDirection, string>>(() => ({
  LEFT: messages.value.directionLeft,
  RIGHT: messages.value.directionRight,
  DOWN: messages.value.directionDown,
  UP: messages.value.directionUp
}))
const options = computed(() =>
  MOTION_DIRECTIONS.map((value) => ({ value, label: labels.value[value] }))
)
const model = computed({
  get: () => direction,
  set: (value: string) => {
    const next = MOTION_DIRECTIONS.find((candidate) => candidate === value)
    if (next) emit('update', next)
  }
})
</script>

<template>
  <!-- The arrows point the way slides move on the canvas, which reads left to right. -->
  <LeftToRight>
    <SegmentedControl
      v-model="model"
      :options="options"
      :label="messages.direction"
      data-property="animate-transition-direction"
    >
      <template #option="{ option }">
        <icon-lucide-arrow-left
          v-if="option.value === 'LEFT'"
          data-direction="physical"
          class="size-3.5"
        />
        <icon-lucide-arrow-right
          v-else-if="option.value === 'RIGHT'"
          data-direction="physical"
          class="size-3.5"
        />
        <icon-lucide-arrow-down v-else-if="option.value === 'DOWN'" class="size-3.5" />
        <icon-lucide-arrow-up v-else class="size-3.5" />
      </template>
    </SegmentedControl>
  </LeftToRight>
</template>
