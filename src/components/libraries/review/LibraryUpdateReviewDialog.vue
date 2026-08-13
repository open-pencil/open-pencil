<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { computed, ref, shallowRef, watch } from 'vue'

import { createLibraryUpdatePreview, type LibraryUpdatePreview } from '@open-pencil/core/library'
import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { closeLibraryReview, libraryReviewRequest, useLibraryService } from '@/app/libraries'
import { toast } from '@/app/shell/ui'
import LibraryComparisonPreview from '@/components/libraries/review/LibraryComparisonPreview.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { AppDialogFooter, AppDialogHeader, AppDialogRoot } from '@/components/ui/dialog'

const editor = useEditorStore()
const service = useLibraryService()
const { panels, dialogs } = useI18n()
const preview = shallowRef<LibraryUpdatePreview | null>(null)
const instanceIndex = ref(0)
const mode = ref<'side-by-side' | 'overlay'>('side-by-side')
const opacity = ref([50])
const loading = ref(false)
let requestId = 0
const open = computed({
  get: () => libraryReviewRequest.value !== null,
  set: (value) => {
    if (!value) closeLibraryReview()
  }
})
const modeOptions = computed(() => [
  { value: 'side-by-side', label: panels.value.sideBySide },
  { value: 'overlay', label: panels.value.overlay }
])
const request = computed(() => libraryReviewRequest.value)
const currentInstanceId = computed(() => request.value?.instanceIds[instanceIndex.value] ?? null)

function pageIdForNode(nodeId: string): string | null {
  let node = editor.graph.getNode(nodeId)
  while (node?.parentId) {
    const parent = editor.graph.getNode(node.parentId)
    if (parent?.type === 'CANVAS') return parent.id
    node = parent
  }
  return null
}

async function focusCurrentInstance() {
  const instanceId = currentInstanceId.value
  if (!instanceId) return
  const pageId = pageIdForNode(instanceId)
  if (pageId && pageId !== editor.state.currentPageId) await editor.switchPage(pageId)
  editor.select([instanceId])
  editor.zoomToSelection()
}

async function loadPreview() {
  const value = request.value
  const instanceId = currentInstanceId.value
  if (!value || !instanceId) return
  const currentRequest = ++requestId
  loading.value = true
  try {
    const revision = await service.getRevision(value.libraryId)
    const next = createLibraryUpdatePreview(editor.graph, instanceId, revision)
    if (currentRequest === requestId) {
      preview.value = next
      await focusCurrentInstance()
    }
  } catch (cause) {
    toast.error(cause instanceof Error ? cause.message : String(cause))
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

async function updateInstance() {
  const id = currentInstanceId.value
  if (!id) return
  await service.applyInstanceUpdate(editor, id)
  closeLibraryReview()
}

async function updateAll() {
  const value = request.value
  if (!value) return
  await service.applyInstanceIdsUpdate(
    editor,
    value.libraryId,
    value.assetKey,
    value.instanceIds,
    `Update ${value.assetKey}`
  )
  closeLibraryReview()
}

watch(request, (value) => {
  if (!value) return
  instanceIndex.value = Math.max(0, value.instanceIds.indexOf(value.initialInstanceId))
  mode.value = 'side-by-side'
  opacity.value = [50]
  preview.value = null
})
watch([request, currentInstanceId], () => void loadPreview(), { immediate: true })
</script>

<template>
  <AppDialogRoot v-model:open="open" size="xl" height="full" data-test-id="library-update-review">
    <AppDialogHeader
      :heading="panels.reviewLibraryUpdate"
      :description="panels.reviewLibraryUpdateDescription"
      :close-label="dialogs.close"
    />
    <div
      v-if="request"
      class="border-b border-border px-4 py-3 text-center text-sm font-medium text-surface"
    >
      {{ preview?.graph.getNode(preview.updatedNodeId)?.name ?? panels.reviewLibraryUpdate }}
    </div>
    <div
      v-if="preview"
      class="relative grid min-h-0 flex-1 bg-canvas"
      :class="mode === 'side-by-side' ? 'grid-cols-2' : 'grid-cols-1'"
    >
      <section class="flex min-h-0 flex-col border-r border-border p-4">
        <h3 class="text-xs font-semibold text-surface">{{ panels.currentVersion }}</h3>
        <div class="flex flex-1 items-center justify-center">
          <LibraryComparisonPreview
            :graph="preview.graph"
            :node-id="preview.currentNodeId"
            :alt="panels.currentVersion"
          />
        </div>
      </section>
      <section
        class="flex min-h-0 flex-col p-4"
        :class="mode === 'overlay' ? 'absolute inset-0' : ''"
        :style="mode === 'overlay' ? { opacity: opacity[0] / 100 } : undefined"
      >
        <h3 class="text-xs font-semibold text-surface">{{ panels.updatedVersion }}</h3>
        <div class="flex flex-1 items-center justify-center">
          <LibraryComparisonPreview
            :graph="preview.graph"
            :node-id="preview.updatedNodeId"
            :alt="panels.updatedVersion"
          />
        </div>
      </section>
      <div class="absolute bottom-3 left-3 flex items-center gap-3 rounded bg-panel p-1 shadow">
        <SegmentedControl
          v-model="mode"
          :options="modeOptions"
          :label="panels.comparisonMode"
          :ui="{ root: 'w-52' }"
        />
        <SliderRoot
          v-if="mode === 'overlay'"
          v-model="opacity"
          :min="0"
          :max="100"
          :step="1"
          :aria-label="panels.overlayOpacity"
          class="relative flex w-32 touch-none items-center"
        >
          <SliderTrack class="relative h-1.5 grow overflow-hidden rounded-full bg-hover">
            <SliderRange class="absolute h-full bg-accent" />
          </SliderTrack>
          <SliderThumb
            class="block size-3.5 rounded-full border border-accent bg-panel shadow outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </SliderRoot>
        <span v-if="mode === 'overlay'" class="w-8 text-right text-[10px] text-muted">
          {{ opacity[0] }}%
        </span>
      </div>
    </div>
    <div v-else class="flex min-h-0 flex-1 items-center justify-center text-xs text-muted">
      {{ loading ? panels.loadingUpdatePreview : panels.noLibraryUpdates }}
    </div>
    <AppDialogFooter :ui="{ footer: 'justify-between' }">
      <div class="flex items-center gap-2 text-xs text-muted">
        <button type="button" :disabled="instanceIndex === 0" @click="instanceIndex--">
          <icon-lucide-chevron-left class="size-4" />
        </button>
        <button
          type="button"
          :disabled="!request || instanceIndex >= request.instanceIds.length - 1"
          @click="instanceIndex++"
        >
          <icon-lucide-chevron-right class="size-4" />
        </button>
        {{
          panels.libraryInstancePosition({
            current: instanceIndex + 1,
            total: request?.instanceIds.length ?? 0
          })
        }}
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded border border-border px-3 py-1.5 text-xs"
          @click="updateInstance"
        >
          {{ panels.updateInstance }}
        </button>
        <button
          type="button"
          class="rounded bg-accent px-3 py-1.5 text-xs text-white"
          @click="updateAll"
        >
          {{ panels.updateAll }}
        </button>
      </div>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
