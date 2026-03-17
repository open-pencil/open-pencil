<script setup lang="ts">
import type { Fill } from '@open-pencil/core'
import { ImageFillControlsRoot, useEditor } from '@open-pencil/vue'

import AppSelect from './AppSelect.vue'

const { fill } = defineProps<{ fill: Fill }>()
const emit = defineEmits<{ update: [fill: Fill] }>()

const store = useEditor()

function resolveImage(hash: string) {
  return store.graph.images.get(hash)
}
</script>

<template>
  <ImageFillControlsRoot
    :fill="fill"
    :resolve-image="resolveImage"
    :store-image="store.storeImage"
    @update="emit('update', $event)"
    v-slot="{ imagePreviewUrl, scaleModes, scaleMode, pickImage, setScaleMode }"
  >
    <div class="space-y-2">
      <div
        v-if="imagePreviewUrl"
        class="flex h-24 items-center justify-center overflow-hidden rounded border border-border"
      >
        <img :src="imagePreviewUrl" class="max-h-full max-w-full object-contain" />
      </div>
      <button
        class="flex h-7 w-full cursor-pointer items-center justify-center gap-1 rounded border border-border bg-input text-xs text-surface hover:bg-hover"
        data-test-id="fill-picker-choose-image"
        @click="pickImage"
      >
        <icon-lucide-image class="size-3" />
        {{ fill.imageHash ? 'Replace' : 'Choose image' }}
      </button>
      <AppSelect
        :model-value="scaleMode"
        :options="scaleModes"
        @update:model-value="setScaleMode"
      />
    </div>
  </ImageFillControlsRoot>
</template>
