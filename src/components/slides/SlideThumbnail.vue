<script setup lang="ts">
import { useElementVisibility, useObjectUrl } from '@vueuse/core'
import { computed, onBeforeUnmount, shallowRef, toRef, useTemplateRef, watch } from 'vue'

import { useEditorStore } from '@/app/editor/active-store'
import { getSlideThumbnail, isRenderedThumbnail } from '@/app/editor/thumbnails/cache'
import { SLIDE_THUMB_MAX_WIDTH } from '@/constants'

const { pageId, alt, scrollTarget } = defineProps<{
  pageId: string
  alt: string
  scrollTarget: HTMLElement | null
}>()

const editor = useEditorStore()
const thumbnail = useTemplateRef<HTMLElement>('thumbnail')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const isVisible = useElementVisibility(thumbnail, {
  scrollTarget: toRef(() => scrollTarget),
  // Roughly two slides ahead in either direction. A 600px margin caused a fast scroll to
  // clone and blit most of a large deck's persisted thumbnails before they were needed.
  rootMargin: '300px 0px'
})
const preview = shallowRef<Awaited<ReturnType<typeof getSlideThumbnail>>['image']>(null)
const previewPixels = computed(() => (isRenderedThumbnail(preview.value) ? preview.value : null))
const previewBlob = computed(() => (preview.value instanceof Blob ? preview.value : null))
const previewUrl = useObjectUrl(previewBlob)
let requestId = 0
let previewRequest: AbortController | null = null

/** Page ids repeat across documents, so the cache key needs the document too. */
function documentId(): string {
  return editor.getDocumentFilePath?.() || editor.state.documentName || 'untitled'
}

async function updatePreview(stale = false) {
  previewRequest?.abort()
  const controller = new AbortController()
  previewRequest = controller
  const currentRequest = ++requestId
  try {
    const { image, refresh } = await getSlideThumbnail(
      documentId(),
      pageId,
      async () => {
        // Rendered at the widest the rail can go and scaled down by CSS, so the render does
        // not depend on the displayed size.
        // One physical pixel per CSS pixel at the rail's maximum size. Rendering the old
        // 2x raster cost ~94ms for this deck versus ~28ms at 1x, and each job blocks input.
        const scale = SLIDE_THUMB_MAX_WIDTH / 1920
        // Raw pixels skip the PNG encode/decode round trip, formerly the dominant cost.
        return editor.renderExportPixels(Math.max(scale, 0.05), pageId)
      },
      { stale, signal: controller.signal }
    )
    if (currentRequest !== requestId) return
    // Keep whatever is on screen if a render came back empty: a slightly stale thumbnail
    // is always better than a blank one, and a failed refresh should not destroy a good
    // image that is already showing.
    if (image) preview.value = image
    if (refresh) {
      // The shown thumbnail came from a previous session; swap in the fresh render.
      const fresh = await refresh
      if (currentRequest === requestId && fresh) preview.value = fresh
    }
  } catch (error) {
    console.warn('[thumbnails] could not render a slide preview', error)
  } finally {
    if (previewRequest === controller) previewRequest = null
  }
}

/**
 * An edit bumps the document-wide scene version, but it only changed the page being
 * edited — so only that thumbnail is stale. Watching the version for every slide made a
 * single edit re-render the entire filmstrip.
 */
const editedVersion = computed(() =>
  pageId === editor.state.currentPageId ? editor.state.sceneVersion : null
)

watch(
  () => [pageId, editedVersion.value, isVisible.value] as const,
  ([, version, visible], previous) => {
    if (!visible) {
      requestId++
      previewRequest?.abort()
      previewRequest = null
      return
    }
    // Moving away changes the outgoing slide's value from a version to `null`; moving onto
    // one does the reverse. Neither transition is an edit. Only two real version values
    // changing while this page remains current should invalidate its cached thumbnail.
    const wasEdited =
      previous !== undefined && previous[1] !== null && version !== null && previous[1] !== version
    void updatePreview(wasEdited)
  },
  { immediate: true, flush: 'post' }
)

onBeforeUnmount(() => previewRequest?.abort())

watch(
  [previewPixels, canvas],
  ([pixels, target]) => {
    if (!pixels || !target) return
    if (target.width !== pixels.width) target.width = pixels.width
    if (target.height !== pixels.height) target.height = pixels.height
    const context = target.getContext('2d')
    if (!context) return
    const data = new Uint8ClampedArray(
      pixels.pixels.buffer,
      pixels.pixels.byteOffset,
      pixels.pixels.byteLength
    )
    context.putImageData(new ImageData(data, pixels.width, pixels.height), 0, 0)
  },
  { flush: 'post' }
)
</script>

<template>
  <div
    ref="thumbnail"
    data-slot="slide-thumbnail"
    class="flex size-full items-center justify-center overflow-hidden"
  >
    <canvas
      v-if="previewPixels"
      ref="canvas"
      role="img"
      :aria-label="alt"
      class="max-h-full max-w-full object-contain"
    />
    <img
      v-else-if="previewUrl"
      :src="previewUrl"
      :alt="alt"
      class="max-h-full max-w-full object-contain"
      draggable="false"
    />
    <icon-lucide-image v-else class="size-4 text-muted" aria-hidden="true" />
  </div>
</template>
