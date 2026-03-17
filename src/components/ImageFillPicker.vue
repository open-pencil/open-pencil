<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useFileDialog, useObjectUrl } from '@vueuse/core'

import AppSelect from './AppSelect.vue'
import { useEditor } from '@open-pencil/vue'

import type { Fill, ImageScaleMode } from '@open-pencil/core'

const IMAGE_SCALE_MODES: { value: ImageScaleMode; label: string }[] = [
  { value: 'FILL', label: 'Fill' },
  { value: 'FIT', label: 'Fit' },
  { value: 'CROP', label: 'Crop' },
  { value: 'TILE', label: 'Tile' }
]

const { fill } = defineProps<{ fill: Fill }>()
const emit = defineEmits<{ update: [fill: Fill] }>()

const store = useEditor()

const imageBlob = shallowRef<Blob | null>(null)
const imagePreviewUrl = useObjectUrl(imageBlob)

watch(
  () => fill.imageHash,
  (hash) => {
    if (!hash) {
      imageBlob.value = null
      return
    }
    const data = store.getImage(hash)
    imageBlob.value = data ? new Blob([data]) : null
  },
  { immediate: true }
)

const { open: pickImage, onChange: onFileChange } = useFileDialog({
  accept: 'image/png,image/jpeg,image/webp',
  multiple: false
})

onFileChange(async (files) => {
  const file = files?.[0]
  if (!file) return
  const bytes = new Uint8Array(await file.arrayBuffer())
  const hash = store.storeImage(bytes)
  emit('update', {
    ...fill,
    type: 'IMAGE',
    imageHash: hash,
    imageScaleMode: fill.imageScaleMode ?? 'FILL'
  })
})

const scaleMode = computed({
  get: () => fill.imageScaleMode ?? ('FILL' as ImageScaleMode),
  set: (mode: ImageScaleMode) => emit('update', { ...fill, imageScaleMode: mode })
})
</script>

<template>
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
      @click="pickImage()"
    >
      <icon-lucide-image class="size-3" />
      {{ fill.imageHash ? 'Replace' : 'Choose image' }}
    </button>
    <AppSelect
      :model-value="scaleMode"
      :options="IMAGE_SCALE_MODES"
      @update:model-value="(m) => (scaleMode = m as ImageScaleMode)"
    />
  </div>
</template>
