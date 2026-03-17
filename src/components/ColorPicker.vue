<script setup lang="ts">
import type { Color } from '@open-pencil/core'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { ColorPickerRoot } from '@open-pencil/vue'

import HsvColorArea from './HsvColorArea.vue'

const { color } = defineProps<{ color: Color }>()
const emit = defineEmits<{ update: [color: Color] }>()
</script>

<template>
  <ColorPickerRoot :color="color" @update="emit('update', $event)" v-slot="{ swatchBg, update }">
    <PopoverRoot>
      <PopoverTrigger as-child>
        <button
          data-test-id="color-picker-swatch"
          class="size-5 shrink-0 cursor-pointer rounded border border-border p-0"
          :style="{ background: swatchBg }"
        />
      </PopoverTrigger>

      <PopoverPortal>
        <PopoverContent
          data-test-id="color-picker-popover"
          class="z-[100] w-56 rounded-lg border border-border bg-panel p-2 shadow-xl"
          :side-offset="4"
          side="left"
        >
          <HsvColorArea :color="color" @update="update" />
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </ColorPickerRoot>
</template>
