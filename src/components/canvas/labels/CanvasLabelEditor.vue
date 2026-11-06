<script setup lang="ts">
import type { ReferenceElement } from 'reka-ui'
import { PopoverContent, PopoverPortal } from 'reka-ui'
import { computed } from 'vue'

import {
  COMPONENT_LABEL_FONT_SIZE,
  COMPONENT_LABEL_GAP,
  LABEL_FONT_SIZE,
  LABEL_OFFSET_Y,
  SECTION_TITLE_FONT_SIZE,
  SECTION_TITLE_HEIGHT,
  SECTION_TITLE_PADDING_X,
  SECTION_TITLE_RADIUS
} from '@open-pencil/core/constants'
import { colorToCSS } from '@open-pencil/scene-graph/color'
import type { CanvasLabelEdit } from '@open-pencil/vue/canvas/labels'

import type { CanvasLabelPresentation } from '@/components/canvas/labels/presentation'
import InlineLabelEditor, {
  type InlineLabelMetrics
} from '@/components/ui/input/InlineLabelEditor.vue'
import AppPopoverRoot from '@/components/ui/overlay/AppPopoverRoot.vue'

const { edit, presentation, reference } = defineProps<{
  edit: CanvasLabelEdit | null
  presentation: CanvasLabelPresentation
  reference: ReferenceElement | null
}>()

// Figma renames a frame or component name in a field the size of the name itself.
const compact = computed(() => !!edit && edit.kind !== 'section-title')

// The field stands in for a label the canvas draws in screen pixels, so its geometry is in
// pixels too rather than following the interface size.
/** The name field's height in screen pixels, as Figma draws it. */
const NAME_FIELD_HEIGHT = 18
const NAME_FIELD_PADDING_X = 2
const NAME_FIELD_RADIUS = 2
/** Inter's line box, ascent plus descent, as a share of its size, the box the canvas lays out. */
const INTER_LINE_BOX = 1.21

/**
 * How far above the layer the field ends, so its text sits exactly where the canvas drew the
 * name: the canvas puts the name's line box this far above the layer, and the field centers its
 * line box in its height.
 */
const nameFontSize = computed(() =>
  edit?.kind === 'component-label' ? COMPONENT_LABEL_FONT_SIZE : LABEL_FONT_SIZE
)

const sideOffset = computed(() => {
  if (!compact.value) return 6
  const gap = edit?.kind === 'component-label' ? COMPONENT_LABEL_GAP : LABEL_OFFSET_Y
  const fontSize = nameFontSize.value
  return gap + fontSize - (NAME_FIELD_HEIGHT + fontSize * INTER_LINE_BOX) / 2
})

const metrics = computed<InlineLabelMetrics>(() =>
  compact.value
    ? {
        fontSize: nameFontSize.value,
        lineHeight: NAME_FIELD_HEIGHT,
        paddingX: NAME_FIELD_PADDING_X
      }
    : {
        fontSize: SECTION_TITLE_FONT_SIZE,
        lineHeight: SECTION_TITLE_HEIGHT,
        paddingX: SECTION_TITLE_PADDING_X
      }
)

const box = computed(() => ({
  backgroundColor: colorToCSS(presentation.background),
  height: `${metrics.value.lineHeight}px`,
  borderRadius: `${compact.value ? NAME_FIELD_RADIUS : SECTION_TITLE_RADIUS}px`
}))

const emit = defineEmits<{
  update: [value: string]
  commit: []
  cancel: []
}>()
</script>

<template>
  <AppPopoverRoot :open="!!edit">
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
        :style="box"
        class="z-50 text-black ring-1 ring-accent data-[foreground=light]:text-white data-[label-kind=section-title]:shadow-sm"
        @open-auto-focus.prevent
        @escape-key-down.prevent="emit('cancel')"
        @pointer-down-outside="emit('commit')"
      >
        <InlineLabelEditor
          :model-value="edit.value"
          label="Layer name"
          :metrics="metrics"
          :variant="compact ? 'name' : 'section'"
          @update:model-value="emit('update', $event)"
          @commit="emit('commit')"
          @cancel="emit('cancel')"
        />
      </PopoverContent>
    </PopoverPortal>
  </AppPopoverRoot>
</template>
