<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { computed, ref, useTemplateRef, watch } from 'vue'

import type { Size } from '@open-pencil/scene-graph/primitives'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import {
  centredCrop,
  clampCrop,
  cropRegion,
  encodePicture,
  PICTURE_MAX_ZOOM,
  pictureScale,
  zoomCrop,
  type PictureCrop
} from '@/app/cloud-portal/picture'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

/** The side of the square the picture is placed in, in CSS pixels. */
const FRAME = 240
/** How far an arrow key moves the picture. */
const ARROW_STEP = 8

/**
 * Places a chosen image in the circle people see: drag it or use the arrow keys, and zoom. The
 * page shrinks the result to the size the server keeps before it is sent.
 */
const {
  file,
  saving = false,
  error = null
} = defineProps<{ file: File | null; saving?: boolean; error?: string | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ save: [picture: Blob] }>()

const messages = useCloudPortalMessages()
const url = useObjectUrl(() => file)
const image = useTemplateRef<HTMLImageElement>('image')
const size = ref<Size | null>(null)
const crop = ref<PictureCrop>({ zoom: 1, x: 0, y: 0 })
const unreadable = ref(false)
let drag: { pointerId: number; x: number; y: number; from: PictureCrop } | null = null

watch(url, () => {
  size.value = null
  unreadable.value = false
})

const zoom = computed({
  get: () => [crop.value.zoom],
  set: ([next]) => {
    if (size.value && next !== undefined) {
      crop.value = zoomCrop(size.value, FRAME, crop.value, next)
    }
  }
})
const placement = computed(() => {
  if (!size.value) return undefined
  return {
    width: `${size.value.width * pictureScale(size.value, FRAME, crop.value.zoom)}px`,
    transform: `translate(${crop.value.x}px, ${crop.value.y}px)`
  }
})

function loaded(event: Event) {
  if (!(event.target instanceof HTMLImageElement)) return
  const { naturalWidth: width, naturalHeight: height } = event.target
  // An image with no size of its own, such as an SVG without one, has nothing to crop.
  if (width === 0 || height === 0) {
    unreadable.value = true
    return
  }
  size.value = { width, height }
  crop.value = centredCrop(size.value, FRAME)
}

function move(dx: number, dy: number, from = crop.value) {
  if (!size.value) return
  crop.value = clampCrop(size.value, FRAME, { ...from, x: from.x + dx, y: from.y + dy })
}

function startDrag(event: PointerEvent) {
  if (!(event.currentTarget instanceof HTMLElement)) return
  event.currentTarget.setPointerCapture(event.pointerId)
  drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, from: crop.value }
}

function dragTo(event: PointerEvent) {
  if (drag?.pointerId !== event.pointerId) return
  move(event.clientX - drag.x, event.clientY - drag.y, drag.from)
}

function endDrag(event: PointerEvent) {
  if (drag?.pointerId === event.pointerId) drag = null
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [ARROW_STEP, 0],
  ArrowRight: [-ARROW_STEP, 0],
  ArrowUp: [0, ARROW_STEP],
  ArrowDown: [0, -ARROW_STEP]
}

function nudge(event: KeyboardEvent) {
  const step = ARROWS[event.key]
  if (!step) return
  event.preventDefault()
  move(...step)
}

async function save() {
  if (!image.value || !size.value) return
  try {
    emit('save', await encodePicture(image.value, cropRegion(size.value, FRAME, crop.value)))
  } catch {
    unreadable.value = true
  }
}
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader
      :heading="messages.pictureTitle"
      :description="messages.pictureDescription"
      :close-label="messages.cancel"
    />
    <AppDialogBody :ui="{ body: 'flex flex-col items-center gap-4' }">
      <AppAlert
        v-if="unreadable || error"
        class="self-stretch"
        tone="error"
        :heading="messages.errorTitle"
        :description="unreadable ? messages.pictureUnreadable : (error ?? undefined)"
      />
      <div
        v-show="!unreadable"
        class="relative size-60 cursor-grab touch-none overflow-hidden rounded bg-canvas outline-none select-none focus-visible:ring-2 focus-visible:ring-accent/50 active:cursor-grabbing"
        tabindex="0"
        role="img"
        :aria-label="messages.pictureDescription"
        @pointerdown="startDrag"
        @pointermove="dragTo"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @keydown="nudge"
      >
        <img
          v-if="url"
          ref="image"
          :src="url"
          alt=""
          draggable="false"
          class="pointer-events-none absolute top-0 left-0 max-w-none"
          :class="{ invisible: !size }"
          :style="placement"
          @load="loaded"
          @error="unreadable = true"
        />
        <div
          class="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] ring-1 ring-white/40"
        />
      </div>
      <SliderRoot
        v-show="!unreadable"
        v-model="zoom"
        :min="1"
        :max="PICTURE_MAX_ZOOM"
        :step="0.01"
        :disabled="!size"
        :aria-label="messages.pictureZoom"
        class="relative flex w-60 touch-none items-center"
      >
        <SliderTrack class="relative h-1.5 grow overflow-hidden rounded-full bg-hover">
          <SliderRange class="absolute h-full bg-accent" />
        </SliderTrack>
        <SliderThumb
          class="block size-3.5 rounded-full border border-accent bg-panel shadow outline-none focus-visible:ring-2 focus-visible:ring-panel-focus"
        />
      </SliderRoot>
    </AppDialogBody>
    <AppDialogFooter :ui="{ footer: 'justify-between' }">
      <AppButton type="button" @click="open = false">{{ messages.cancel }}</AppButton>
      <AppButton
        type="button"
        color="primary"
        variant="solid"
        :loading="saving"
        :disabled="!size"
        @click="save"
      >
        {{ messages.savePicture }}
      </AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
