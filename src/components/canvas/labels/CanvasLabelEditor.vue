<script setup lang="ts">
import type { ReferenceElement } from 'reka-ui'
import { PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'

import { colorToCSS } from '@open-pencil/core/color'
import type { CanvasLabelEdit } from '@open-pencil/vue'

import InlineLabelEditor from '@/components/ui/input/InlineLabelEditor.vue'
import type { CanvasLabelPresentation } from '@/components/canvas/labels/presentation'

const { edit, presentation, reference } = defineProps<{
  edit: CanvasLabelEdit | null
  presentation: CanvasLabelPresentation
  reference: ReferenceElement | null
}>()

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
        :side-offset="6"
        :collision-padding="8"
        :data-label-kind="edit.kind"
        :data-foreground="presentation.foreground"
        :style="{ backgroundColor: colorToCSS(presentation.background) }"
        class="z-50 h-6 rounded-[5px] text-black shadow-sm ring-1 ring-accent data-[foreground=light]:text-white"
        @open-auto-focus.prevent
        @escape-key-down.prevent="emit('cancel')"
        @pointer-down-outside="emit('commit')"
      >
        <InlineLabelEditor
          :model-value="edit.value"
          label="Layer name"
          @update:model-value="emit('update', $event)"
          @commit="emit('commit')"
          @cancel="emit('cancel')"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
