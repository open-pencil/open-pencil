<script setup lang="ts">
import type { ReferenceElement } from 'reka-ui'
import { PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { computed } from 'vue'

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
        :side-offset="compact ? 5 : 6"
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
          :compact="compact"
          @update:model-value="emit('update', $event)"
          @commit="emit('commit')"
          @cancel="emit('cancel')"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
