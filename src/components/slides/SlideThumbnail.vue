<script setup lang="ts">
import { useElementVisibility, useObjectUrl } from '@vueuse/core'
import { shallowRef, useTemplateRef, watch } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'

const { pageId, alt, width } = defineProps<{
  pageId: string
  alt: string
  width: number
}>()

const editor = useEditorStore()
const thumbnail = useTemplateRef<HTMLElement>('thumbnail')
const isVisible = useElementVisibility(thumbnail)
const previewBlob = shallowRef<Blob | null>(null)
const previewUrl = useObjectUrl(previewBlob)
let requestId = 0

async function updatePreview() {
  const currentRequest = ++requestId
  try {
    // Whole page → PNG at filmstrip width (×2 for density)
    const scale = (width * 2) / 1920
    const data = await editor.renderExportImage([], Math.max(scale, 0.05), 'PNG', pageId)
    if (currentRequest !== requestId) return
    previewBlob.value = data ? new Blob([data], { type: 'image/png' }) : null
  } catch {
    if (currentRequest === requestId) previewBlob.value = null
  }
}

watch(
  () => [pageId, width, editor.state.sceneVersion, isVisible.value] as const,
  ([, , , visible]) => {
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
