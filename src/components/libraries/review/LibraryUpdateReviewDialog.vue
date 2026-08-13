<script setup lang="ts">
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
const opacity = ref(50)
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

async function loadPreview() {
  const value = request.value
  const instanceId = currentInstanceId.value
  if (!value || !instanceId) return
  const currentRequest = ++requestId
  loading.value = true
  try {
    const revision = await service.getRevision(value.libraryId)
    const next = createLibraryUpdatePreview(editor.graph, instanceId, revision)
    if (currentRequest === requestId) preview.value = next
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
  await service.applyAssetUpdate(editor, value.libraryId, value.assetKey)
  closeLibraryReview()
}

watch([request, currentInstanceId], () => void loadPreview(), { immediate: true })
</script>

<template>
  <AppDialogRoot v-model:open="open" size="xl" height="full" data-test-id="library-update-review">
    <AppDialogHeader :heading="panels.reviewLibraryUpdate" :close-label="dialogs.close" />
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
        :style="mode === 'overlay' ? { opacity: opacity / 100 } : undefined"
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
        <SegmentedControl v-model="mode" :options="modeOptions" :label="panels.comparisonMode" />
        <input
          v-if="mode === 'overlay'"
          v-model.number="opacity"
          type="range"
          min="0"
          max="100"
          :aria-label="panels.overlayOpacity"
        />
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
