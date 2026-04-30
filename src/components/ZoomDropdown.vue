<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { nextTick, ref, watch } from 'vue'

import { useEditorCommands, useI18n } from '@open-pencil/vue'
import { menuItem, useMenuUI } from '@/components/ui/menu'
import { useEditorStore } from '@/app/editor/active-store'

const store = useEditorStore()
const { getCommand } = useEditorCommands()
const { menu: menuText, commands, panels } = useI18n()

const open = ref(false)
const editing = ref(false)
const inputRef = ref<HTMLInputElement | null>()
const inputValue = ref('')

const menuCls = useMenuUI({ content: 'min-w-52' })
const itemCls = menuItem({ justify: 'start', class: 'relative pl-7' })

function zoomPercent() {
  return Math.round(store.state.zoom * 100)
}

function startEditing() {
  editing.value = true
  inputValue.value = String(zoomPercent())
  void nextTick(() => inputRef.value?.select())
}

function commitInput() {
  const parsed = Number.parseInt(inputValue.value, 10)
  if (!Number.isNaN(parsed) && parsed > 0) {
    store.zoomToLevel(parsed / 100)
  }
  editing.value = false
}

function cancelInput() {
  editing.value = false
}

function toggleRulers() {
  store.state.showRulers = !store.state.showRulers
  store.requestRepaint()
}

function toggleRemoteCursors() {
  store.state.showRemoteCursors = !store.state.showRemoteCursors
  store.requestRepaint()
}

function zoomIn() {
  const center = store.viewportScreenCenter()
  store.applyZoom(-100, center.x, center.y)
}

function zoomOut() {
  const center = store.viewportScreenCenter()
  store.applyZoom(100, center.x, center.y)
}

const ZOOM_PRESETS: ReadonlyArray<{ label: string; level: number; shortcut?: string }> = [
  { label: '50%', level: 0.5 },
  { label: '100%', level: 1, shortcut: '⌘0' },
  { label: '200%', level: 2 }
]

function isActivePreset(level: number) {
  return Math.abs(store.state.zoom - level) < 0.005
}

watch(open, (v) => {
  if (!v) editing.value = false
})
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger as-child>
      <button
        data-test-id="zoom-dropdown-trigger"
        class="ml-auto cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover"
      >
        {{ zoomPercent() }}%
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        side="bottom"
        :side-offset="4"
        align="end"
        :class="menuCls.content"
        @escape-key-down="cancelInput"
      >
        <div class="px-1 py-1">
          <input
            v-if="editing"
            ref="inputRef"
            v-model="inputValue"
            data-test-id="zoom-input"
            class="w-full rounded border border-accent bg-input px-2 py-1 text-xs text-surface outline-none"
            @blur="commitInput"
            @keydown.enter="commitInput"
            @keydown.escape.stop="cancelInput"
          />
          <button
            v-else
            data-test-id="zoom-input-trigger"
            class="w-full cursor-pointer rounded border border-border bg-input px-2 py-1 text-left text-xs text-surface hover:border-muted"
            @click="startEditing"
          >
            {{ zoomPercent() }}%
          </button>
        </div>

        <DropdownMenuSeparator :class="menuCls.separator" />

        <DropdownMenuItem :class="itemCls" @select="zoomIn">
          <span class="flex-1">{{ menuText.zoomIn }}</span>
          <span class="text-[11px] text-muted">⌘+</span>
        </DropdownMenuItem>
        <DropdownMenuItem :class="itemCls" @select="zoomOut">
          <span class="flex-1">{{ menuText.zoomOut }}</span>
          <span class="text-[11px] text-muted">⌘−</span>
        </DropdownMenuItem>
        <DropdownMenuItem :class="itemCls" @select="getCommand('view.zoomFit').run()">
          <span class="flex-1">{{ commands.zoomToFit }}</span>
          <span class="text-[11px] text-muted">⇧1</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          v-for="preset in ZOOM_PRESETS"
          :key="preset.level"
          :class="itemCls"
          @select="store.zoomToLevel(preset.level)"
        >
          <icon-lucide-check v-if="isActivePreset(preset.level)" class="absolute left-2 size-3.5" />
          <span class="flex-1">{{ preset.label }}</span>
          <span v-if="preset.shortcut" class="text-[11px] text-muted">{{ preset.shortcut }}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator :class="menuCls.separator" />

        <DropdownMenuItem :class="itemCls" @select.prevent="toggleRulers">
          <icon-lucide-check v-if="store.state.showRulers" class="absolute left-2 size-3.5" />
          <span class="flex-1">{{ panels.rulers }}</span>
        </DropdownMenuItem>
        <DropdownMenuItem :class="itemCls" @select.prevent="toggleRemoteCursors">
          <icon-lucide-check
            v-if="store.state.showRemoteCursors"
            class="absolute left-2 size-3.5"
          />
          <span class="flex-1">{{ panels.multiplayerCursors }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
