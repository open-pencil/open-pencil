<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { useSectionUI } from '@/components/ui/section'
import { FRAME_PRESET_CATEGORIES, type FramePreset } from '@/app/editor/frame-presets'

const editor = useEditorStore()
const sectionCls = useSectionUI()
const { panels } = useI18n()

function createPresetFrame(preset: FramePreset) {
  const canvasCenter = editor.viewportCanvasCenter()
  const { x: cx, y: cy } = editor.screenToCanvas(canvasCenter.x, canvasCenter.y)

  editor.undo.runBatch('Create frame', () => {
    const id = editor.createShape(
      'FRAME',
      cx - preset.width / 2,
      cy - preset.height / 2,
      preset.width,
      preset.height
    )
    editor.select([id])
  })
  editor.setTool('SELECT')
  editor.requestRender()
}
</script>

<template>
  <div data-test-id="frame-presets-section" :class="sectionCls.wrapper">
    <label :class="sectionCls.label">{{ panels.framePresets }}</label>

    <div v-for="category in FRAME_PRESET_CATEGORIES" :key="category.key" class="mb-2 last:mb-0">
      <div class="mb-0.5 flex items-center gap-1.5 px-1 text-[10px] text-muted">
        <component :is="category.icon" class="size-3" />
        <span>{{ panels[category.labelKey] }}</span>
      </div>

      <button
        v-for="preset in category.presets"
        :key="preset.id"
        :data-test-id="`frame-preset-${preset.id}`"
        type="button"
        class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-surface hover:bg-hover"
        @click="createPresetFrame(preset)"
      >
        <span class="min-w-0 flex-1 truncate">{{ panels[preset.labelKey] }}</span>
        <span class="shrink-0 text-[10px] text-muted">{{ preset.width }} × {{ preset.height }}</span>
      </button>
    </div>
  </div>
</template>
