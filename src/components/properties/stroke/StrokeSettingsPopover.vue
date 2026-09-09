<script setup lang="ts">
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent, PopoverClose } from 'reka-ui'

import type { Stroke } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'

import StrokeDashControls from './StrokeDashControls.vue'
import StrokeGeometryControls from './StrokeGeometryControls.vue'

const { stroke } = defineProps<{ stroke?: Stroke }>()
const emit = defineEmits<{ patch: [changes: Partial<Stroke>] }>()
const { panels, common } = useI18n()
const styles = usePopoverUI({
  content: 'w-64 max-w-[calc(100vw-1rem)]',
  header: 'flex items-center justify-between border-b border-border px-3 py-2',
  body: 'flex flex-col gap-3 p-3'
})
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <AppButton :aria-label="panels.strokeSettings" data-property="stroke-settings">
        <icon-lucide-sliders-horizontal class="size-3.5" />
      </AppButton>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="left"
        align="start"
        :side-offset="8"
        :aria-label="panels.strokeSettings"
        :class="styles.content"
      >
        <div :class="styles.header">
          <h3 class="text-xs font-semibold text-surface">{{ panels.strokeSettings }}</h3>
          <PopoverClose as-child
            ><AppButton :aria-label="common.close"><icon-lucide-x class="size-3.5" /></AppButton
          ></PopoverClose>
        </div>
        <div :class="styles.body">
          <StrokeDashControls v-if="stroke" :stroke="stroke" @patch="emit('patch', $event)" />
          <StrokeGeometryControls />
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
