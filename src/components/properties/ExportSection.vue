<script setup lang="ts">
import { ref, computed, watch, onScopeDispose } from 'vue'

import AppSelect from '@/components/ui/AppSelect.vue'
import ExportScaleInput from '@/components/properties/ExportScaleInput.vue'
import Tip from '@/components/ui/Tip.vue'
import { useIconButtonUI } from '@/components/ui/icon-button'
import { useSectionUI } from '@/components/ui/section'
import { useEditorStore } from '@/app/editor/active-store'
import { useExport, useI18n } from '@open-pencil/vue'

import type { ExportFormatId } from '@open-pencil/vue'

const editorStore = useEditorStore()
const { panels } = useI18n()
const sectionCls = useSectionUI()
const {
  activeTarget,
  activeName,
  activeSettings,
  targetIds,
  mixed,
  addSetting,
  removeSetting,
  updateScale,
  updateFormat,
  formatSupportsScale,
  scales,
  clampExportScale
} = useExport()

const FORMAT_OPTIONS: { value: ExportFormatId; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WEBP' },
  { value: 'svg', label: 'SVG' },
  { value: 'pdf', label: 'PDF' }
]

const previewUrl = ref<string | null>(null)
const showPreview = ref(false)
const exporting = ref(false)

const PREVIEW_WIDTH = 480

async function doExport() {
  exporting.value = true
  try {
    const requests = []
    for (const id of targetIds.value) {
      const node = editorStore.graph.getNode(id)
      if (!node) continue
      const target =
        activeTarget.value === 'page'
          ? ({ scope: 'page', pageId: id } as const)
          : ({ scope: 'node', nodeId: id } as const)
      for (const setting of node.exportSettings) {
        requests.push({ target, formatId: setting.format, options: { scale: setting.scale } })
      }
    }
    // A single file downloads directly; multiple files bundle into one zip.
    await editorStore.exportTargets(requests)
  } finally {
    exporting.value = false
  }
}

async function updatePreview() {
  if (!showPreview.value) return

  const ids =
    activeTarget.value === 'selection'
      ? [...editorStore.state.selectedIds]
      : editorStore.graph.getChildren(editorStore.state.currentPageId).map((n) => n.id)

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
  () =>
    `${activeTarget.value}:${editorStore.state.sceneVersion}:${editorStore.state.currentPageId}:${[
      ...editorStore.state.selectedIds
    ]
      .sort()
      .join(',')}`
)

watch(() => showPreview.value, updatePreview, { flush: 'post' })
watch(previewKey, updatePreview, { flush: 'post' })

onScopeDispose(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <div data-test-id="export-section" :class="sectionCls.wrapper">
    <div class="flex items-center justify-between">
      <label :class="sectionCls.label">{{ panels.export }}</label>
      <Tip :label="panels.addExport">
        <button
          data-test-id="export-section-add"
          :class="useIconButtonUI().base"
          @click="addSetting"
        >
          +
        </button>
      </Tip>
    </div>
    <p v-if="mixed && activeSettings.length > 0" class="text-[11px] text-muted">
      {{ panels.mixed }}
    </p>

    <div
      v-for="(setting, i) in activeSettings"
      :key="`${targetIds.join(',')}:${i}`"
      data-test-id="export-item"
      :data-test-index="i"
      class="flex items-center gap-1.5 py-0.5"
    >
      <ExportScaleInput
        v-if="formatSupportsScale(setting.format)"
        :model-value="setting.scale"
        :presets="scales"
        :clamp="clampExportScale"
        :label="panels.exportScale"
        @update:model-value="updateScale(i, $event)"
      />
      <AppSelect
        :model-value="setting.format"
        :options="FORMAT_OPTIONS"
        :label="panels.exportFormat"
        @update:model-value="updateFormat(i, $event as ExportFormatId)"
      />
      <Tip :label="panels.removeExport">
        <button
          :class="useIconButtonUI({ ui: { base: 'shrink-0' } }).base"
          @click="removeSetting(i)"
        >
          −
        </button>
      </Tip>
    </div>

    <button
      v-if="activeSettings.length > 0"
      data-test-id="export-button"
      class="mt-1.5 w-full cursor-pointer truncate rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-default disabled:opacity-50"
      :disabled="exporting"
      @click="doExport"
    >
      {{ panels.export }} {{ activeName }}
    </button>

    <Tip v-if="activeSettings.length > 0" :label="panels.toggleExportPreview">
      <button
        data-test-id="export-preview-toggle"
        class="mt-1 flex w-full cursor-pointer items-center gap-1 rounded border-none bg-transparent px-0 py-1 text-[11px] text-muted hover:text-surface"
        @click="showPreview = !showPreview"
      >
        <icon-lucide-chevron-down v-if="showPreview" class="size-3" />
        <icon-lucide-chevron-right v-else class="size-3" />
        {{ panels.exportPreview }}
      </button>
    </Tip>

    <div v-if="showPreview && previewUrl" class="mt-1 overflow-hidden rounded border border-border">
      <img
        :src="previewUrl"
        class="block w-full"
        style="
          image-rendering: auto;
          background: repeating-conic-gradient(var(--color-checkerboard) 0% 25%, transparent 0% 50%)
            50% / 16px 16px;
        "
      />
    </div>
    <div
      v-else-if="showPreview"
      class="mt-1 rounded border border-border px-3 py-2 text-[11px] text-muted"
    >
      {{ panels.exportRenderingPreview }}
    </div>
  </div>
</template>
