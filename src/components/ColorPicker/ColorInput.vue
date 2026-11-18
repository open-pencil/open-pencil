<script setup lang="ts">
import { computed, normalizeClass, useAttrs } from 'vue'

import type { Color } from '@open-pencil/scene-graph/primitives'
import type { OkHCLControls } from '@open-pencil/vue/controls/color-model'
import { ColorInputRoot } from '@open-pencil/vue/primitives/ColorPicker'
import { inputValue } from '@open-pencil/vue/shared/dom-events'

import ColorPicker from '@/components/ColorPicker/ColorPicker.vue'
import PaintField from '@/components/inputs/PaintField.vue'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
// The field's class is merged by its theme, which takes a class string.
const fieldAttrs = computed(() => ({ ...attrs, class: normalizeClass(attrs.class) }))

const {
  editable = false,
  color,
  okhcl = null,
  tone = 'panel'
} = defineProps<{
  color: Color
  editable?: boolean
  okhcl?: OkHCLControls | null
  /** The field it stands on, as `PaintField`'s `tone`. */
  tone?: 'panel' | 'form'
}>()
defineSlots<{
  /** A variable button at the field's end. */
  binding?(): unknown
}>()
const emit = defineEmits<{ update: [color: Color]; openChange: [open: boolean] }>()
// The hex reads at the size of the field's other text.
const hexSize = computed(() => (tone === 'form' ? 'text-xs' : 'text-2xs'))
</script>

<template>
  <ColorInputRoot
    :color="color"
    :editable="editable"
    :okhcl="okhcl"
    @update="emit('update', $event)"
  >
    <template #default="{ editable: isEditable, hex, actions, okhcl: okhclControls }">
      <!-- A paint row's frame, so a colour reads alike wherever the panel edits one. -->
      <PaintField v-bind="fieldAttrs" :tone="tone">
        <template #preview>
          <ColorPicker
            :color="color"
            :okhcl="okhclControls"
            @update="actions.updateColor($event)"
            @open-change="emit('openChange', $event)"
          />
        </template>
        <template #value>
          <input
            v-if="isEditable"
            data-test-id="color-hex-input"
            :class="[
              'min-w-0 flex-1 border-none bg-transparent font-mono text-surface outline-none',
              hexSize
            ]"
            :value="hex"
            maxlength="6"
            @change="actions.updateFromHex(inputValue($event))"
          />
          <span v-else :class="['min-w-0 flex-1 truncate font-mono text-muted', hexSize]">
            {{ hex }}
          </span>
        </template>
        <template v-if="$slots.binding" #binding><slot name="binding" /></template>
      </PaintField>
    </template>
  </ColorInputRoot>
</template>
