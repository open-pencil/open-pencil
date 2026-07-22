<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'

import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { FRAME_PRESET_CATEGORIES, type FramePreset } from '@/app/editor/frame-presets'

const store = useEditorStore()
const { panels } = useI18n()

function createFrame(preset: FramePreset) {
  store.createFrameFromPreset(preset)
}
</script>

<template>
  <section :aria-label="panels.frame">
    <div class="flex h-10 items-center border-b border-border px-3">
      <span role="heading" aria-level="2" class="text-[11px] font-semibold text-surface">
        {{ panels.frame }}
      </span>
    </div>

    <CollapsibleRoot
      v-for="category in FRAME_PRESET_CATEGORIES"
      :key="category.id"
      v-slot="{ open }"
      :default-open="category.id === 'phone'"
      class="border-b border-border"
    >
      <CollapsibleTrigger
        class="flex h-9 w-full items-center gap-1.5 px-3 text-left text-[11px] text-surface hover:bg-hover"
      >
        <icon-lucide-chevron-right
          class="size-3 shrink-0 transition-transform data-[open]:rotate-90"
          :data-open="open || undefined"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1 truncate">{{ panels[category.labelKey] }}</span>
      </CollapsibleTrigger>

      <CollapsibleContent class="pb-1.5">
        <button
          v-for="preset in category.presets"
          :key="preset.id"
          type="button"
          :data-frame-preset="preset.id"
          class="flex h-7 w-full items-center gap-2 px-7 text-left text-[11px] text-surface hover:bg-hover"
          @click="createFrame(preset)"
        >
          <span class="min-w-0 flex-1 truncate">{{ preset.name }}</span>
          <span class="shrink-0 tabular-nums text-muted">
            {{ preset.width }} × {{ preset.height }}
          </span>
        </button>
      </CollapsibleContent>
    </CollapsibleRoot>
  </section>
</template>
