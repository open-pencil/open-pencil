<script setup lang="ts">
import type { Easing } from '@open-pencil/scene-graph'
import type { MotionControl } from '@open-pencil/vue/controls/motion'
import { useMessages } from '@open-pencil/vue/i18n'

import MotionFields from '@/components/inputs/MotionFields.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

/**
 * How the control eases into each state, in preview and exported code: a duration in
 * milliseconds and an easing, each its own value or a TIMING or EASING variable's. Without one
 * the control changes state at once.
 */
const { transition } = defineProps<{ transition: MotionControl | null }>()
const emit = defineEmits<{
  add: []
  remove: []
  set: [patch: { duration?: number; easing?: Easing }]
  bind: [field: 'duration' | 'easing', variableId: string | null]
}>()
const behaviourMessages = useMessages('panels/behaviours')
</script>

<template>
  <div class="flex flex-col gap-1.5" data-property="behaviour-transition">
    <div class="flex items-center justify-between gap-2">
      <span class="text-2xs text-muted">{{ behaviourMessages.transition }}</span>
      <IconButton
        v-if="transition"
        :label="behaviourMessages.removeTransition"
        data-test-id="behaviour-remove-transition"
        @click="emit('remove')"
      >
        <icon-lucide-minus class="size-3.5" />
      </IconButton>
      <IconButton
        v-else
        :label="behaviourMessages.addTransition"
        data-test-id="behaviour-add-transition"
        @click="emit('add')"
      >
        <icon-lucide-plus class="size-3.5" />
      </IconButton>
    </div>
    <MotionFields
      v-if="transition"
      :motion="transition"
      :duration-label="behaviourMessages.transitionDuration"
      :easing-label="behaviourMessages.transitionEasing"
      name="behaviour-transition"
      @set="emit('set', $event)"
      @bind="(field, variableId) => emit('bind', field, variableId)"
    />
  </div>
</template>
