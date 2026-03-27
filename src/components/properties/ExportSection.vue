<script setup lang="ts">
import { ref, computed, watch, onScopeDispose } from 'vue'

import AppSelect from '@/components/ui/AppSelect.vue'
import { iconButton } from '@/components/ui/icon-button'
import { sectionLabel, sectionWrapper } from '@/components/ui/section'
import { useEditorStore } from '@/stores/editor'
import { useExport, useI18n } from '@open-pencil/vue'

import type { ExportFormatId } from '@open-pencil/vue/controls/useExport'

const editorStore = useEditorStore()
const { panels } = useI18n()
const {
  settings,
  nodeName,
  addSetting,
  removeSetting,
  updateScale,
  updateFormat,
  formatSupportsScale
} = useExport()

const SCALE_OPTIONS = [0.5, 0.75, 1, 1.5, 2, 3, 4].map((s) => ({ value: s, label: `${s}x` }))
const FORMAT_OPTIONS: { value: ExportFormatId; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WEBP' },
  { value: 'svg', label: 'SVG' },
  { value: 'fig', label: '.fig' }
]

const previewUrl = ref<string | null>(null)
const showPreview = ref(false)
const exporting = ref(false)

const PREVIEW_WIDTH = 480

async function doExport(exportSettings: Array<{ scale: number; format: ExportFormatId }>) {
  exporting.value = true
  try {
    for (const s of exportSettings) await editorStore.exportSelection(s.scale, s.format)
  } finally {
    exporting.value = false
  }
}

async function updatePreview() {
  if (!showPreview.value) return
  const ids = [...editorStore.state.selectedIds]
  if (ids.length === 0) {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
    return
  }
  let maxW = 0
  for (const id of ids) {
    const node = editorStore.getNode(id)
    if (node) maxW = Math.max(maxW, node.width)
  }
  const scale = maxW > 0 ? Math.min(PREVIEW_WIDTH / maxW, 2) : 1
  const data = await editorStore.renderExportImage(ids, scale, 'PNG')
  if (data) {
    const prev = previewUrl.value
    previewUrl.value = URL.createObjectURL(new Blob([data], { type: 'image/png' }))
    if (prev) URL.revokeObjectURL(prev)
  }
}

const previewKey = computed(
  () => `${editorStore.state.sceneVersion}:${[...editorStore.state.selectedIds].sort().join(',')}`
)

watch(() => showPreview.value, updatePreview, { flush: 'post' })
watch(previewKey, updatePreview, { flush: 'post' })

onScopeDispose(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <div data-test-id="export-section" :class="sectionWrapper()">
    <div class="flex items-center justify-between">
      <label :class="sectionLabel()">{{ panels.export }}</label>
      <button data-test-id="export-section-add" :class="iconButton()" @click="addSetting">+</button>
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
        :disabled="!formatSupportsScale(setting.format)"
        @update:model-value="updateScale(i, Number($event))"
      />
      <AppSelect
        :model-value="setting.format"
        :options="FORMAT_OPTIONS"
        @update:model-value="updateFormat(i, $event as ExportFormatId)"
      />
      <button :class="iconButton({ ui: { base: 'shrink-0' } })" @click="removeSetting(i)">−</button>
    </div>

    <button
      v-if="settings.length > 0"
      data-test-id="export-button"
      class="mt-1.5 w-full cursor-pointer truncate rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-default disabled:opacity-50"
      :disabled="exporting"
      @click="doExport(settings)"
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
