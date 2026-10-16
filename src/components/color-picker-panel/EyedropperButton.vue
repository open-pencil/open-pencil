<script setup lang="ts">
import { ref } from 'vue'
import IconPipette from '~icons/lucide/pipette'

import { requestEyedropperSample, useEditor, useI18n } from '@open-pencil/vue'

import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'
import IconButton from '@/components/ui/button/IconButton.vue'

const ctx = useColorPickerPanelContext()
const editor = useEditor()
const { tools } = useI18n()
const sampling = ref(false)

async function pick() {
  const alpha = ctx.color.a
  sampling.value = true
  try {
    const sampled = await requestEyedropperSample(editor)
    // The picker keeps its own opacity; the sample only brings the color.
    if (sampled) ctx.emitUpdate({ ...sampled, a: alpha })
  } finally {
    sampling.value = false
  }
}
</script>

<template>
  <IconButton :label="tools.eyedropperSample" :active="sampling" side="bottom" @click="pick">
    <IconPipette class="size-3.5" />
  </IconButton>
</template>
