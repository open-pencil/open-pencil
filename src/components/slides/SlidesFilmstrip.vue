<script setup lang="ts">
import { refAutoReset, useEventListener, useResizeObserver } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch, type ComponentPublicInstance } from 'vue'
import { tv } from 'tailwind-variants'

import { addEmptySlide } from '@open-pencil/deck'
import { useFlatReorderDrag, useI18n, usePageList } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { thumbnailDocumentId } from '@/app/editor/thumbnails/document'
import { pruneStoredThumbnails } from '@/app/editor/thumbnails/store'
import Tip from '@/components/ui/Tip.vue'
import SlideThumbnail from '@/components/slides/SlideThumbnail.vue'
import { SLIDE_THUMB_INDEX_GUTTER, SLIDE_THUMB_MAX_WIDTH, SLIDE_THUMB_MIN_WIDTH } from '@/constants'
import slidesRailTheme from '@/theme/slides-rail'

const editor = useEditorStore()
const { panels } = useI18n()
const { pages, currentPageId, switchPage, movePage } = usePageList()
const styles = tv(slidesRailTheme)

/**
 * A loaded document is the only moment its page list is known to be complete, and so the
 * only moment it is safe to say which stored thumbnails belong to pages that are gone.
 */
watch(
  () => [editor.state.loading, pages.value.length] as const,
  ([loading, count]) => {
    if (loading || count === 0) return
    void pruneStoredThumbnails(
      thumbnailDocumentId(editor),
      pages.value.map((page) => page.id)
    )
  },
  { immediate: true }
)

/** Editing affordances are withheld while this window is driving a presentation. */
const presenterMode = computed(() => editor.state.presenterMode)
const base = styles()

const listEl = useTemplateRef<HTMLElement>('list')
const viewportEl = useTemplateRef<HTMLElement>('viewport')
const listWidth = ref(0)
const elasticOffset = refAutoReset(0, 90)

const elasticListStyle = computed(() => ({
  transform: `translateY(${elasticOffset.value}px)`
}))

/** Give wheel/trackpad input a small physical stop at either end of the filmstrip. */
useEventListener(
  viewportEl,
  'wheel',
  (event) => {
    const viewport = viewportEl.value
    if (!viewport || event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

    const nextScrollTop = viewport.scrollTop + event.deltaY
    const reachesTop = event.deltaY < 0 && nextScrollTop <= 0
    const reachesBottom =
      event.deltaY > 0 && nextScrollTop + viewport.clientHeight >= viewport.scrollHeight
    if (!reachesTop && !reachesBottom) return

    const strength = Math.min(10, 4 + Math.abs(event.deltaY) * 0.04)
    elasticOffset.value = reachesTop ? strength : -strength
  },
  { passive: true }
)

useResizeObserver(listEl, (entries) => {
  const entry = entries[0]
  if (!entry) return
  listWidth.value = entry.contentRect.width
})

/**
 * Thumb width tracks the left panel, preferring the Figma-like range but never exceeding
 * the space available: a thumbnail wider than the rail is simply clipped, which looks
 * broken. Fitting the width wins over honouring the minimum.
 */
const thumbWidth = computed(() => {
  const available = Math.max(0, listWidth.value - SLIDE_THUMB_INDEX_GUTTER)
  if (available <= 0) return SLIDE_THUMB_MIN_WIDTH
  return Math.min(SLIDE_THUMB_MAX_WIDTH, available)
})

const thumbShellStyle = computed(() => ({
  width: `${thumbWidth.value}px`,
  // No floor here: a min wider than the rail is exactly what caused the clipping.
  maxWidth: '100%'
}))

type SlideCell = {
  id: string
  name: string
  indexLabel: string
  active: boolean
}

const cells = computed<SlideCell[]>(() =>
  pages.value.map((page, index) => ({
    id: page.id,
    name: page.name || String(index + 1),
    indexLabel: String(index + 1),
    active: page.id === currentPageId.value
  }))
)

/**
 * Slide order is page order, so reordering is `movePage` — the same operation the
 * pages panel performs, through the same shared drag composable.
 */
const reorder = useFlatReorderDrag<SlideCell>({
  items: () => cells.value,
  onMove: (pageId, index) => movePage(pageId, index)
})

function dropPosition(cell: SlideCell): 'before' | 'after' | undefined {
  if (reorder.instructionTargetId.value !== cell.id) return undefined
  if (reorder.instruction.value?.operation === 'reorder-before') return 'before'
  if (reorder.instruction.value?.operation === 'reorder-after') return 'after'
  return undefined
}

function cellStyles(cell: SlideCell) {
  return styles({
    active: cell.active,
    dragging: reorder.draggingId.value === cell.id,
    dropPosition: dropPosition(cell)
  })
}

/**
 * Reordering is editing, so the presenter view registers no drag sources at all
 * rather than dropping the move at the end — same reason the toolbar is hidden.
 */
function setupCellRef(value: Element | ComponentPublicInstance | null, cell: SlideCell) {
  const element = !presenterMode.value && value instanceof HTMLElement ? value : null
  reorder.setupItem(element, () => ({ id: cell.id }))
}

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
    <!--
      Adding slides is editing, and the presenter view must not mutate the deck mid-talk.
    -->
    <div v-if="!presenterMode" :class="base.toolbar()">
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
    <div ref="viewport" :class="base.viewport()">
      <div ref="list" :class="base.list()" :style="elasticListStyle" role="list">
        <button
          v-for="cell in cells"
          :key="cell.id"
          :ref="(value) => setupCellRef(value, cell)"
          type="button"
          role="listitem"
          data-test-id="slides-cell"
          :data-page-id="cell.id"
          :data-active="cell.active ? 'true' : undefined"
          :data-dragging="reorder.draggingId.value === cell.id || undefined"
          :data-drop-position="dropPosition(cell)"
          :class="cellStyles(cell).cell()"
          :aria-current="cell.active ? 'true' : undefined"
          :aria-label="cell.name"
          @click="onSelect(cell.id)"
        >
          <div
            v-if="dropPosition(cell) === 'before'"
            data-test-id="slides-drop-indicator"
            :class="cellStyles(cell).dropIndicator()"
          />
          <span :class="base.index()" :data-active="cell.active ? 'true' : undefined">
            {{ cell.indexLabel }}
          </span>
          <div :class="base.thumbShell()" :style="thumbShellStyle">
            <div :class="base.activeChrome()" :data-active="cell.active ? 'true' : 'false'">
              <div :class="base.thumb()" :data-active="cell.active ? 'true' : undefined">
                <SlideThumbnail :page-id="cell.id" :alt="cell.name" :scroll-target="viewportEl" />
              </div>
            </div>
          </div>
          <div
            v-if="dropPosition(cell) === 'after'"
            data-test-id="slides-drop-indicator"
            :class="cellStyles(cell).dropIndicator()"
          />
        </button>
      </div>
    </div>
  </div>
</template>
