<script setup lang="ts">
import { useElementVisibility, useObjectUrl } from '@vueuse/core'
import { computed, shallowRef, useTemplateRef, watch } from 'vue'

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

/** Page ids repeat across documents, so the cache key needs the document too. */
function documentId(): string {
  return editor.getDocumentFilePath?.() || editor.state.documentName || 'untitled'
}

async function updatePreview(stale = false) {
  const currentRequest = ++requestId
  try {
    const { blob, refresh } = await getSlideThumbnail(
      documentId(),
      pageId,
      async () => {
        // Rendered at the widest the rail can go and scaled down by CSS, so the render does
        // not depend on the displayed size.
        const scale = (SLIDE_THUMB_MAX_WIDTH * 2) / 1920
        const data = await editor.renderExportImage([], Math.max(scale, 0.05), 'PNG', pageId)
        return data ? new Blob([data], { type: 'image/png' }) : null
      },
      { stale }
    )
    if (currentRequest !== requestId) return
    previewBlob.value = blob
    if (refresh) {
      // The shown thumbnail came from a previous session; swap in the fresh render.
      const fresh = await refresh
      if (currentRequest === requestId && fresh) previewBlob.value = fresh
    }
  } catch {
    if (currentRequest === requestId) previewBlob.value = null
  }
}

/**
 * An edit bumps the document-wide scene version, but it only changed the page being
 * edited — so only that thumbnail is stale. Watching the version for every slide made a
 * single edit re-render the entire filmstrip.
 */
const editedVersion = computed(() =>
  pageId === editor.state.currentPageId ? editor.state.sceneVersion : 0
)

watch(
  () => [pageId, editedVersion.value, isVisible.value] as const,
  ([, version, visible], previous) => {
    if (!visible) return
    const wasEdited = previous !== undefined && previous[1] !== version && previous[1] !== 0
    void updatePreview(wasEdited)
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
