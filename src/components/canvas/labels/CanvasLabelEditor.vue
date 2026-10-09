<script setup lang="ts">
import type { ReferenceElement } from 'reka-ui'
import { PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { computed } from 'vue'

import {
  COMPONENT_LABEL_FONT_SIZE,
  COMPONENT_LABEL_GAP,
  LABEL_FONT_SIZE,
  LABEL_OFFSET_Y
} from '@open-pencil/core/constants'
import { colorToCSS } from '@open-pencil/scene-graph/color'
import type { CanvasLabelEdit } from '@open-pencil/vue'

import type { CanvasLabelPresentation } from '@/components/canvas/labels/presentation'
import InlineLabelEditor from '@/components/ui/input/InlineLabelEditor.vue'

const { edit, presentation, reference } = defineProps<{
  edit: CanvasLabelEdit | null
  presentation: CanvasLabelPresentation
  reference: ReferenceElement | null
}>()

// Figma renames a frame or component name in a field the size of the name itself.
const compact = computed(() => !!edit && edit.kind !== 'section-title')

/** The name field's height in screen pixels, as Figma draws it. */
const NAME_FIELD_HEIGHT = 18
/** Inter's line box, ascent plus descent, as a share of its size, the box the canvas lays out. */
const INTER_LINE_BOX = 1.21

/**
 * How far above the layer the field ends, so its text sits exactly where the canvas drew the
 * name: the canvas puts the name's line box this far above the layer, and the field centers its
 * line box in its height.
 */
const sideOffset = computed(() => {
  if (!compact.value) return 6
  const component = edit?.kind === 'component-label'
  const fontSize = component ? COMPONENT_LABEL_FONT_SIZE : LABEL_FONT_SIZE
  const lineTop = (component ? COMPONENT_LABEL_GAP : LABEL_OFFSET_Y) + fontSize
  return lineTop - (NAME_FIELD_HEIGHT + fontSize * INTER_LINE_BOX) / 2
})

const emit = defineEmits<{
  update: [value: string]
  commit: []
  cancel: []
}>()
</script>

<template>
  <PopoverRoot :open="!!edit">
    <PopoverPortal>
      <PopoverContent
        v-if="edit && reference"
        :reference="reference"
        side="top"
        align="start"
        :side-offset="sideOffset"
        :align-offset="compact ? -2 : 0"
        :collision-padding="8"
        :data-label-kind="edit.kind"
        :data-foreground="presentation.foreground"
        :style="{ backgroundColor: colorToCSS(presentation.background) }"
        class="z-50 text-black ring-1 ring-accent data-[foreground=light]:text-white"
        :class="compact ? 'h-[18px] rounded-[2px]' : 'h-6 rounded-[5px] shadow-sm'"
        @open-auto-focus.prevent
        @escape-key-down.prevent="emit('cancel')"
        @pointer-down-outside="emit('commit')"
      >
        <InlineLabelEditor
          :model-value="edit.value"
          label="Layer name"
          :variant="compact ? 'name' : 'section'"
          @update:model-value="emit('update', $event)"
          @commit="emit('commit')"
          @cancel="emit('cancel')"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
