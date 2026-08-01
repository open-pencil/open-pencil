<script setup lang="ts">
import { useElementVisibility, useObjectUrl } from '@vueuse/core'
import { shallowRef, useTemplateRef, watch } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import { getSlideThumbnail } from '@/components/slides/thumbnail-cache'
import { SLIDE_THUMB_MAX_WIDTH } from '@/constants'

const { pageId, alt } = defineProps<{
  pageId: string
  alt: string
}>()

const editor = useEditorStore()
const thumbnail = useTemplateRef<HTMLElement>('thumbnail')
const isVisible = useElementVisibility(thumbnail)
const previewBlob = shallowRef<Blob | null>(null)
const previewUrl = useObjectUrl(previewBlob)
let requestId = 0

async function updatePreview() {
  const currentRequest = ++requestId
  const sceneVersion = editor.state.sceneVersion
  try {
    const blob = await getSlideThumbnail(pageId, sceneVersion, async () => {
      // Rendered at the widest the rail can go and scaled down by CSS, so the render does
      // not depend on the displayed size.
      const scale = (SLIDE_THUMB_MAX_WIDTH * 2) / 1920
      const data = await editor.renderExportImage([], Math.max(scale, 0.05), 'PNG', pageId)
      return data ? new Blob([data], { type: 'image/png' }) : null
    })
    if (currentRequest !== requestId) return
    previewBlob.value = blob
  } catch {
    if (currentRequest === requestId) previewBlob.value = null
  }
}

watch(
  () => [pageId, editor.state.sceneVersion, isVisible.value] as const,
  ([, , visible]) => {
    if (visible) void updatePreview()
  },
  { immediate: true, flush: 'post' }
)
</script>

<template>
  <div
    ref="thumbnail"
    data-slot="slide-thumbnail"
    class="flex size-full items-center justify-center overflow-hidden"
  >
    <img
      v-if="previewUrl"
      :src="previewUrl"
      :alt="alt"
      class="max-h-full max-w-full object-contain"
      draggable="false"
    />
    <icon-lucide-image v-else class="size-4 text-muted" aria-hidden="true" />
  </div>
</template>
