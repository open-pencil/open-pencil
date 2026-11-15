<script setup lang="ts">
import { useFileDialog } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import type { StockPhotoResult } from '@open-pencil/core/tools'
import type { Fill, ImageScaleMode } from '@open-pencil/scene-graph'
import { coverImageTransform } from '@open-pencil/scene-graph/images'
import { useI18n } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import { downloadPhoto } from '@/app/editor/photos/download'
import type { PhotoService } from '@/app/editor/photos/search'
import { toast } from '@/app/shell/ui'
import NumberField from '@/components/inputs/NumberField.vue'
import PhotoPicker from '@/components/photo-picker/PhotoPicker.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { useImageDrop } from '@/components/ui/drop/useImageDrop'
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

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const { open: pickImage, onChange: onFileChange } = useFileDialog({
  accept: IMAGE_TYPES.join(','),
  multiple: false
})

function fillWith(bytes: Uint8Array) {
  const hash = store.storeImage(bytes)
  emit('update', {
    ...fill,
    type: 'IMAGE',
    imageHash: hash,
    imageScaleMode: fill.imageScaleMode ?? 'FILL'
  })
}

async function fillWithFile(file: File) {
  fillWith(new Uint8Array(await file.arrayBuffer()))
}

onFileChange((files) => {
  const file = files?.[0]
  if (file) void fillWithFile(file)
})

// An image dropped on the well fills as one chosen with the button does; with several, the first.
const well = useTemplateRef<HTMLElement>('well')
const { dragging } = useImageDrop(well, {
  accepts: (file) => IMAGE_TYPES.includes(file.type),
  onImages: ([file]) => {
    if (file) void fillWithFile(file)
  }
})

async function fillWithPhoto(photo: StockPhotoResult, service: PhotoService) {
  try {
    fillWith((await downloadPhoto(service, photo)).bytes)
  } catch {
    toast.error(panels.value.insertPhotoFailed)
  }
}

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
    <!--
      As Figma's image fill: the image, with its actions in the middle. With no image they show at
      once; over an image they show on hover or when the keyboard reaches them.
    -->
    <div
      ref="well"
      class="group relative flex h-28 items-center justify-center overflow-hidden rounded border border-border bg-panel-secondary data-[dragging]:border-accent"
      :data-empty="imagePreviewURL ? undefined : ''"
      :data-dragging="dragging ? '' : undefined"
      data-test-id="fill-picker-image-well"
    >
      <img
        v-if="imagePreviewURL"
        :src="imagePreviewURL"
        alt=""
        class="max-h-full max-w-full object-contain"
      />
      <div
        class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-data-[empty]:bg-transparent group-data-[empty]:opacity-100 has-[:focus-visible]:opacity-100 motion-reduce:transition-none"
      >
        <AppButton
          size="sm"
          variant="outline"
          class="w-32 bg-panel"
          data-test-id="fill-picker-choose-image"
          @click="pickImage()"
        >
          <template #leading><icon-lucide-upload class="size-3" /></template>
          {{ fill.imageHash ? 'Replace' : 'Choose image' }}
        </AppButton>
        <PhotoPicker :heading="panels.stockPhoto" @select="fillWithPhoto">
          <template #trigger>
            <AppButton
              size="sm"
              variant="outline"
              class="w-32 bg-panel"
              data-test-id="fill-picker-stock-photo"
            >
              <template #leading><icon-lucide-image-plus class="size-3" /></template>
              {{ panels.stockPhoto }}
            </AppButton>
          </template>
        </PhotoPicker>
      </div>
    </div>
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
