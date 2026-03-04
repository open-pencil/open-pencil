<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

import AppSelect from '@/components/AppSelect.vue'
import { useEditorStore } from '@/stores/editor'

import type { ExportFormat } from '@/engine/render-image'

const store = useEditorStore()

interface ExportSetting {
  scale: number
  format: ExportFormat
}

const settings = ref<ExportSetting[]>([{ scale: 1, format: 'PNG' }])
const previewUrl = ref<string | null>(null)
const showPreview = ref(false)
const exporting = ref(false)

const SCALES = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const
const SCALE_OPTIONS = SCALES.map((s) => ({ value: s, label: s % 1 === 0 ? `${s}x` : `${s}x` }))
const FORMATS: ExportFormat[] = ['PNG', 'JPG', 'WEBP']
const FORMAT_OPTIONS = FORMATS.map((f) => ({ value: f, label: f }))

const nodeName = computed(() => {
  void store.state.sceneVersion
  const ids = store.state.selectedIds
  if (ids.size === 1) {
    const id = [...ids][0]
    return store.graph.getNode(id)?.name ?? 'Export'
  }
  return `${ids.size} layers`
})

function addSetting() {
  const last = settings.value[settings.value.length - 1]
  const nextScale = SCALES.find((s) => s > (last?.scale ?? 1)) ?? 2
  settings.value.push({ scale: nextScale, format: last?.format ?? 'PNG' })
}

function removeSetting(index: number) {
  settings.value.splice(index, 1)
}

async function doExport() {
  exporting.value = true
  try {
    for (const setting of settings.value) {
      await store.exportSelection(setting.scale, setting.format)
    }
  } finally {
    exporting.value = false
  }
}

const PREVIEW_WIDTH = 480

async function updatePreview() {
  if (!showPreview.value) return
  const ids = [...store.state.selectedIds]
  if (ids.length === 0) {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = null
    }
    return
  }

  let maxW = 0
  for (const id of ids) {
    const node = store.graph.getNode(id)
    if (node) maxW = Math.max(maxW, node.width)
  }
  const scale = maxW > 0 ? Math.min(PREVIEW_WIDTH / maxW, 2) : 1

  const data = await store.renderExportImage(ids, scale, 'PNG')
  if (data) {
    const prev = previewUrl.value
    previewUrl.value = URL.createObjectURL(new Blob([data], { type: 'image/png' }))
    if (prev) URL.revokeObjectURL(prev)
  }
}

const previewKey = computed(
  () => `${store.state.sceneVersion}:${[...store.state.selectedIds].sort().join(',')}`
)

watch(() => showPreview.value, updatePreview, { flush: 'post' })
watch(previewKey, updatePreview, { flush: 'post' })

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <div data-test-id="export-section" class="border-b border-border px-3 py-2">
    <div class="flex items-center justify-between">
      <label class="mb-1 block text-[11px] text-muted">Export</label>
      <button
        data-test-id="export-section-add"
        class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-sm leading-none text-muted hover:bg-hover hover:text-surface"
        @click="addSetting"
      >
        +
      </button>
    </div>

    <div
      v-for="(setting, i) in settings"
      :key="i"
      data-test-id="export-item"
      :data-test-index="i"
      class="flex items-center gap-1.5 py-0.5"
    >
      <AppSelect
        :model-value="setting.scale"
        :options="SCALE_OPTIONS"
        @update:model-value="setting.scale = Number($event)"
      />
      <AppSelect
        :model-value="setting.format"
        :options="FORMAT_OPTIONS"
        @update:model-value="setting.format = $event as ExportFormat"
      />

      <button
        class="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-sm leading-none text-muted hover:bg-hover hover:text-surface"
        @click="removeSetting(i)"
      >
        −
      </button>
    </div>

    <button
      v-if="settings.length > 0"
      data-test-id="export-button"
      class="mt-1.5 w-full cursor-pointer truncate rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-default disabled:opacity-50"
      :disabled="exporting"
      @click="doExport"
    >
      Export {{ nodeName }}
    </button>

    <button
      v-if="settings.length > 0"
      data-test-id="export-preview-toggle"
      class="mt-1 flex w-full cursor-pointer items-center gap-1 rounded border-none bg-transparent px-0 py-1 text-[11px] text-muted hover:text-surface"
      @click="showPreview = !showPreview"
    >
      <icon-lucide-chevron-down v-if="showPreview" class="size-3" />
      <icon-lucide-chevron-right v-else class="size-3" />
      Preview
    </button>

    <div v-if="showPreview && previewUrl" class="mt-1 overflow-hidden rounded border border-border">
      <img
        :src="previewUrl"
        class="block w-full"
        style="
          image-rendering: auto;
          background: repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 16px 16px;
        "
      />
    </div>
    <div
      v-else-if="showPreview"
      class="mt-1 rounded border border-border px-3 py-2 text-[11px] text-muted"
    >
      Rendering preview…
    </div>
  </div>
</template>
