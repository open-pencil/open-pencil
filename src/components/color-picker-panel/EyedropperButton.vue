<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'

import { useEditor } from '@open-pencil/vue'
import {
  cancelEyedropperSample,
  offersEyedropper,
  requestEyedropperSample
} from '@open-pencil/vue/canvas/eyedropper'
import { useI18n } from '@open-pencil/vue/i18n'

import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'
import IconButton from '@/components/ui/button/IconButton.vue'

const ctx = useColorPickerPanelContext()
const editor = useEditor()
const { tools } = useI18n()
const offered = computed(() => offersEyedropper(editor))
const sampling = ref(false)

/** Starts sampling, or, pressed again while it samples, gives the sample up. */
async function pick() {
  if (sampling.value) {
    cancelEyedropperSample(editor)
    return
  }
  sampling.value = true
  try {
    const sampled = await requestEyedropperSample(editor)
    // The picker keeps its own opacity; the sample only brings the color.
    if (sampled) ctx.updateColor({ ...sampled, a: ctx.color.a })
  } finally {
    sampling.value = false
  }
}

// Closing the picker gives up the sample it still waits on.
onScopeDispose(() => {
  if (sampling.value) cancelEyedropperSample(editor)
})
</script>

<template>
  <IconButton
    v-if="offered"
    :label="tools.eyedropperSample"
    :active="sampling"
    toggle
    data-test-id="color-eyedropper"
    @click="pick"
  >
    <icon-lucide-pipette class="size-3.5" />
  </IconButton>
</template>
