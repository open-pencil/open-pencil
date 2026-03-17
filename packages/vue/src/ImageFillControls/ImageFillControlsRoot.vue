<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useFileDialog, useObjectUrl } from '@vueuse/core'

import type { Fill, ImageScaleMode } from '@open-pencil/core'

const IMAGE_SCALE_MODES: { value: ImageScaleMode; label: string }[] = [
  { value: 'FILL', label: 'Fill' },
  { value: 'FIT', label: 'Fit' },
  { value: 'CROP', label: 'Crop' },
  { value: 'TILE', label: 'Tile' }
]

const { fill, resolveImage, storeImage } = defineProps<{
  fill: Fill
  resolveImage: (hash: string) => Uint8Array | undefined
  storeImage: (bytes: Uint8Array) => string
}>()
const emit = defineEmits<{ update: [fill: Fill] }>()

const imageBlob = shallowRef<Blob | null>(null)
const imagePreviewUrl = useObjectUrl(imageBlob)

watch(
  () => fill.imageHash,
  (hash) => {
    if (!hash) {
      imageBlob.value = null
      return
    }
    const data = resolveImage(hash)
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
  const hash = storeImage(bytes)
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
  <slot
    :fill="fill"
    :image-preview-url="imagePreviewUrl"
    :scale-mode="scaleMode"
    :scale-modes="IMAGE_SCALE_MODES"
    :pick-image="() => pickImage()"
    :set-scale-mode="(m: ImageScaleMode) => (scaleMode = m)"
  />
</template>
