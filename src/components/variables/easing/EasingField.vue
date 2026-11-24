<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, ref } from 'vue'

import type { Easing } from '@open-pencil/scene-graph'
import { useMessages } from '@open-pencil/vue/i18n'

import PaintField from '@/components/inputs/PaintField.vue'
import { useInlineSide } from '@/components/ui/direction/inline-side'
import AppPopoverRoot from '@/components/ui/overlay/AppPopoverRoot.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import theme from '@/theme/variables/easing'

import EasingEditor from './EasingEditor.vue'
import { easingLabel } from './presets'
import { easingThumbnail } from './thumbnail'

/**
 * An easing value's field: its thumbnail and name, which open the editor beside the panel, and
 * the variable button at its end, as a color's field holds its swatch, hex and button.
 */
const { easing, label } = defineProps<{ easing: Easing; label: string }>()
defineSlots<{ binding?(): unknown }>()
const emit = defineEmits<{ update: [easing: Easing, gesture?: string] }>()

const text = useMessages('variables/easing')
const ui = tv(theme)()
const popover = usePopoverUI({ content: 'p-0' })
const side = useInlineSide('start')
const open = ref(false)
const name = computed(() => easingLabel(easing, text.value))
const thumbnail = computed(() => easingThumbnail(easing))
</script>

<template>
  <PaintField tone="form">
    <template #preview>
      <component :is="thumbnail" :class="ui.thumbnail()" />
    </template>
    <template #value>
      <AppPopoverRoot v-model:open="open">
        <PopoverTrigger
          :class="ui.trigger()"
          :aria-label="`${label}: ${text.editEasing}`"
          data-test-id="easing-field"
        >
          <span :class="ui.name()">{{ name }}</span>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent :class="popover.content" :side="side" align="start" :side-offset="8">
            <EasingEditor
              :easing="easing"
              @update="(next, gesture) => emit('update', next, gesture)"
              @close="open = false"
            />
          </PopoverContent>
        </PopoverPortal>
      </AppPopoverRoot>
    </template>
    <template v-if="$slots.binding" #binding><slot name="binding" /></template>
  </PaintField>
</template>
