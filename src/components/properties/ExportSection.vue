<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'

import AppSelect from '@/components/ui/AppSelect.vue'
import ExportScaleInput from '@/components/properties/ExportScaleInput.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelItemRow from '@/components/ui/panel/PanelItemRow.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import Tip from '@/components/ui/Tip.vue'
import { useEditorStore } from '@/app/editor/active-store'
import { useExport, useI18n } from '@open-pencil/vue'
import { CHECKERBOARD_BACKGROUND } from '@/theme/checkerboard'

import type { ExportFormatId } from '@open-pencil/vue'

const editorStore = useEditorStore()
const { panels } = useI18n()
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

const previewBlob = shallowRef<Blob | null>(null)
const previewUrl = useObjectUrl(previewBlob)
const showPreview = ref(false)
const exporting = ref(false)

const PREVIEW_WIDTH = 480

async function doExport() {
  exporting.value = true
  try {
    const requests = []
    // Export exactly the rows shown in the panel (activeSettings) for every target,
    // so a multi-selection exports what the user sees rather than each node's own
    // (possibly hidden / divergent) settings.
    for (const id of targetIds.value) {
      const node = editorStore.graph.getNode(id)
      if (!node) continue
      const target =
        activeTarget.value === 'page'
          ? ({ scope: 'page', pageId: id } as const)
          : ({ scope: 'node', nodeId: id } as const)
      for (const setting of activeSettings.value) {
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
    previewBlob.value = null
    return
  }

  let maxW = 0
  for (const id of ids) {
    const node = editorStore.getNode(id)
    if (node) maxW = Math.max(maxW, node.width)
  }
  const scale = maxW > 0 ? Math.min(PREVIEW_WIDTH / maxW, 2) : 1
  const data = await editorStore.renderExportImage(ids, scale, 'PNG')
  previewBlob.value = data ? new Blob([data], { type: 'image/png' }) : null
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
</script>

<template>
  <PanelSection :label="panels.export" :empty="activeSettings.length === 0">
    <template #actions>
      <IconButton :label="panels.addExport" @click="addSetting">
        <icon-lucide-plus class="size-3.5" />
      </IconButton>
    </template>
    <p v-if="mixed" class="text-[11px] text-muted">
      {{ panels.mixed }}
    </p>

    <PanelItemRow
      v-for="(setting, index) in activeSettings"
      :key="`${targetIds.join(',')}:${index}`"
      data-property="exportSettings"
      :data-index="index"
    >
      <div v-if="formatSupportsScale(setting.format)" class="w-24 shrink-0">
        <ExportScaleInput
          :model-value="setting.scale"
          :presets="scales"
          :clamp="clampExportScale"
          :label="panels.exportScale"
          data-property="export-scale"
          @update:model-value="updateScale(index, $event)"
        />
      </div>
      <AppSelect
        :model-value="setting.format"
        :options="FORMAT_OPTIONS"
        :label="panels.exportFormat"
        :ui="{ trigger: 'w-auto flex-1' }"
        data-property="export-format"
        @update:model-value="updateFormat(index, $event as ExportFormatId)"
      />
      <template #rail="{ removeClass }">
        <IconButton
          :label="panels.removeExport"
          :class="[removeClass, 'shrink-0']"
          @click="removeSetting(index)"
        >
          <icon-lucide-minus class="size-3.5" />
        </IconButton>
      </template>
    </PanelItemRow>

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
      <img :src="previewUrl" :class="['block w-full', CHECKERBOARD_BACKGROUND]" />
    </div>
    <div
      v-else-if="showPreview"
      class="mt-1 rounded border border-border px-3 py-2 text-[11px] text-muted"
    >
      {{ panels.exportRenderingPreview }}
    </div>
  </PanelSection>
</template>
