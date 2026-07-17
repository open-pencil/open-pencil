<script setup lang="ts">
import { tv } from 'tailwind-variants'

import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import pageListTheme from '@/theme/page-list'
import tabBarTheme from '@/theme/tab-bar'

const pageStyles = tv(pageListTheme)
const tabStyles = tv(tabBarTheme)
const panelTabsUI = { root: 'w-full' }
const panelOptions = [
  { value: 'file', label: 'File' },
  { value: 'assets', label: 'Assets' }
]
const pageStates = [
  { label: 'Normal', active: false, dragging: false },
  { label: 'Active', active: true, dragging: false },
  { label: 'Dragging', active: false, dragging: true },
  { label: 'Drop before', active: false, dragging: false, dropPosition: 'before' as const },
  { label: 'Drop after', active: false, dragging: false, dropPosition: 'after' as const }
]
</script>

<template>
  <div class="grid max-w-3xl grid-cols-2 gap-6">
    <section class="rounded-lg border border-border bg-panel p-3 shadow-lg">
      <h2 class="mb-3 text-[11px] font-semibold tracking-wider text-muted uppercase">
        Page and panel states
      </h2>
      <SegmentedControl
        model-value="file"
        :options="panelOptions"
        label="Panel"
        :ui="panelTabsUI"
      />
      <div class="mt-3 space-y-1">
        <div
          v-for="state in pageStates"
          :key="state.label"
          :aria-label="state.label"
          :class="
            pageStyles({
              active: state.active,
              dragging: state.dragging,
              dropPosition: state.dropPosition
            }).row()
          "
          :data-active="state.active || undefined"
          :data-dragging="state.dragging || undefined"
          :data-drop-position="state.dropPosition"
        >
          <div
            v-if="state.dropPosition"
            :class="pageStyles({ dropPosition: state.dropPosition }).dropIndicator()"
          />
          <button :class="pageStyles({ active: state.active }).item()">
            <icon-lucide-file :class="pageStyles().icon()" />
            <span :class="pageStyles().label()">{{ state.label }}</span>
          </button>
        </div>
        <div aria-label="Rename" :class="pageStyles().renameRow()">
          <icon-lucide-file :class="pageStyles().icon()" />
          <input :class="pageStyles().renameInput()" value="Rename page" />
        </div>
      </div>
    </section>

    <section class="rounded-lg border border-border bg-canvas p-3 shadow-lg">
      <h2 class="mb-3 text-[11px] font-semibold tracking-wider text-muted uppercase">Tab states</h2>
      <div :class="tabStyles().root()">
        <div :class="tabStyles().list()">
          <button
            aria-label="Active tab"
            :class="tabStyles({ active: true }).trigger()"
            data-active
          >
            <icon-lucide-file :class="tabStyles().icon()" />
            <span :class="tabStyles().label()">Active</span>
            <span :class="tabStyles({ active: true }).close()" data-active>
              <icon-lucide-x :class="tabStyles().closeIcon()" />
            </span>
          </button>
          <button aria-label="Inactive tab" :class="tabStyles({ active: false }).trigger()">
            <icon-lucide-file :class="tabStyles().icon()" />
            <span :class="tabStyles().label()">Inactive</span>
            <span :class="tabStyles({ active: false }).close()">
              <icon-lucide-x :class="tabStyles().closeIcon()" />
            </span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
