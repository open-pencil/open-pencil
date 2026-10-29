<script setup lang="ts">
import { useFileDialog } from '@vueuse/core'
import { computed } from 'vue'

import type { Fill, ImageScaleMode } from '@open-pencil/scene-graph'
import { coverImageTransform } from '@open-pencil/scene-graph/images'
import { useI18n } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import NumberField from '@/components/inputs/NumberField.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import { useImageFill } from './useImageFill'

const IMAGE_SCALE_MODES: { value: ImageScaleMode; label: string }[] = [
  { value: 'FILL', label: 'Fill' },
  { value: 'FIT', label: 'Fit' },
  { value: 'CROP', label: 'Crop' },
  { value: 'TILE', label: 'Tile' }
]

const { fill, layerSize = null } = defineProps<{
  fill: Fill
  /** The layer the fill is on, which a new crop starts by covering, as Fill does. */
  layerSize?: { width: number; height: number } | null
}>()
const emit = defineEmits<{ update: [fill: Fill] }>()

const store = useEditorStore()
const { panels } = useI18n()

const { url: imagePreviewURL, size: imageSize } = useImageFill(() => fill.imageHash, {
  measure: true
})

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

/**
 * Figma keeps a crop through other modes, which ignore it, but a new crop starts over from the
 * Fill framing; without the layer's or image's size the renderer frames it as Fill does.
 */
function cropStart(): Fill['imageTransform'] {
  const image = imageSize.value
  if (!layerSize || !image) return undefined
  return coverImageTransform(layerSize.width, layerSize.height, image.width, image.height)
}

const scaleMode = computed({
  get: () => fill.imageScaleMode ?? ('FILL' as ImageScaleMode),
  set: (mode: ImageScaleMode) => {
    if (mode === scaleMode.value) return
    const next: Fill = { ...fill, imageScaleMode: mode }
    if (mode === 'CROP') next.imageTransform = cropStart()
    emit('update', next)
  }
})

/** A tile's size as a percentage of the image's own. */
const tileScale = computed(() => Math.round((fill.scale && fill.scale > 0 ? fill.scale : 1) * 100))
function setTileScale(percent: number) {
  if (percent > 0) emit('update', { ...fill, scale: percent / 100 })
}

function rotate() {
  emit('update', { ...fill, imageRotation: ((fill.imageRotation ?? 0) + 90) % 360 })
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-if="imagePreviewURL"
      class="flex h-24 items-center justify-center overflow-hidden rounded border border-border"
    >
      <img :src="imagePreviewURL" class="max-h-full max-w-full object-contain" />
    </div>
    <AppButton
      variant="outline"
      class="w-full"
      data-test-id="fill-picker-choose-image"
      @click="pickImage()"
    >
      <template #leading><icon-lucide-image class="size-3" /></template>
      {{ fill.imageHash ? 'Replace' : 'Choose image' }}
    </AppButton>
    <div class="flex items-center gap-1.5">
      <AppSelect
        :ui="{ trigger: 'min-w-0 flex-1' }"
        :model-value="scaleMode"
        :options="IMAGE_SCALE_MODES"
        @update:model-value="(m) => (scaleMode = m as ImageScaleMode)"
      />
      <div v-if="scaleMode === 'TILE'" class="w-16 flex-none">
        <NumberField
          :model-value="tileScale"
          :min="1"
          suffix="%"
          :aria-label="panels.imageTileScale"
          data-test-id="fill-picker-tile-scale"
          @update:model-value="setTileScale"
          @commit="setTileScale"
        />
      </div>
      <!-- A crop holds its own turn in its transform, so only the other modes turn the image. -->
      <IconButton
        v-if="scaleMode !== 'CROP'"
        :label="panels.rotate90"
        data-test-id="fill-picker-rotate-image"
        @click="rotate"
      >
        <icon-lucide-rotate-cw class="size-3.5" />
      </IconButton>
    </div>
  </div>
</template>
