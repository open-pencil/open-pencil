<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import { tv } from 'tailwind-variants'

import { addEmptySlide } from '@open-pencil/deck'
import { useI18n, usePageList } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import Tip from '@/components/ui/Tip.vue'
import SlideThumbnail from '@/components/slides/SlideThumbnail.vue'
import { SLIDE_THUMB_INDEX_GUTTER, SLIDE_THUMB_MAX_WIDTH, SLIDE_THUMB_MIN_WIDTH } from '@/constants'
import slidesRailTheme from '@/theme/slides-rail'

const editor = useEditorStore()
const { panels } = useI18n()
const { pages, currentPageId, switchPage } = usePageList()
const styles = tv(slidesRailTheme)
const base = styles()

const listEl = useTemplateRef<HTMLElement>('list')
const listWidth = ref(0)

useResizeObserver(listEl, (entries) => {
  const entry = entries[0]
  if (!entry) return
  listWidth.value = entry.contentRect.width
})

/** Thumb width tracks the left panel, clamped to Figma-like min/max. */
const thumbWidth = computed(() => {
  const available = Math.max(0, listWidth.value - SLIDE_THUMB_INDEX_GUTTER)
  if (available <= 0) return SLIDE_THUMB_MIN_WIDTH
  return Math.min(SLIDE_THUMB_MAX_WIDTH, Math.max(SLIDE_THUMB_MIN_WIDTH, available))
})

const thumbShellStyle = computed(() => ({
  width: `${thumbWidth.value}px`,
  minWidth: `${SLIDE_THUMB_MIN_WIDTH}px`,
  maxWidth: `${SLIDE_THUMB_MAX_WIDTH}px`
}))

const cells = computed(() =>
  pages.value.map((page, index) => ({
    id: page.id,
    name: page.name || String(index + 1),
    indexLabel: String(index + 1),
    active: page.id === currentPageId.value
  }))
)

async function onSelect(pageId: string) {
  await switchPage(pageId)
  await editor.fitCurrentPageToViewport()
}

async function onNewSlide() {
  const pageId = addEmptySlide(editor.graph)
  await editor.switchPage(pageId)
  await editor.fitCurrentPageToViewport()
  editor.requestRender()
}
</script>

<template>
  <div data-test-id="slides-filmstrip" :class="base.panel()">
    <header :class="base.header()">
      <span :class="base.title()">{{ panels.slides }}</span>
    </header>
    <div :class="base.toolbar()">
      <button type="button" data-test-id="slides-new" :class="base.newSlide()" @click="onNewSlide">
        {{ panels.newSlide }}
      </button>
      <Tip :label="panels.newSlide">
        <button
          type="button"
          data-test-id="slides-add"
          :class="base.add()"
          :aria-label="panels.newSlide"
          @click="onNewSlide"
        >
          +
        </button>
      </Tip>
    </div>
    <div :class="base.viewport()">
      <div ref="list" :class="base.list()" role="list">
        <button
          v-for="cell in cells"
          :key="cell.id"
          type="button"
          role="listitem"
          :data-page-id="cell.id"
          :data-active="cell.active ? 'true' : undefined"
          :class="styles({ active: cell.active }).cell()"
          :aria-current="cell.active ? 'true' : undefined"
          :aria-label="cell.name"
          @click="onSelect(cell.id)"
        >
          <span :class="base.index()" :data-active="cell.active ? 'true' : undefined">
            {{ cell.indexLabel }}
          </span>
          <div :class="base.thumbShell()" :style="thumbShellStyle">
            <div :class="base.activeChrome()" :data-active="cell.active ? 'true' : 'false'">
              <div :class="base.thumb()" :data-active="cell.active ? 'true' : undefined">
                <SlideThumbnail :page-id="cell.id" :alt="cell.name" :width="thumbWidth" />
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
