<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuSeparator
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, nextTick, ref, useTemplateRef, watch, type ComponentPublicInstance } from 'vue'

import { resolveEditorProfile } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { slideNumbers, slideRows, slideSettings } from '@open-pencil/scene-graph/slides'
import { useMessages } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'
import { useFlatReorderDrag } from '@open-pencil/vue/shared/drag'

import { useEditorStore } from '@/app/editor/active-store'
import { useSlideThumbnails } from '@/app/editor/slides/thumbnails'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppContextMenuRoot from '@/components/ui/menu/AppContextMenuRoot.vue'
import AppContextMenuTrigger from '@/components/ui/menu/AppContextMenuTrigger.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'
import slidesPanelTheme from '@/theme/slides/panel'

import SlidesPanelThumbnail from './SlidesPanelThumbnail.vue'

/** A deck's filmstrip: its slides by section, to pick, reorder, and put on the stage. */
const store = useEditorStore()
const messages = useMessages('slides')
const menuCls = useMenuUI({ content: 'min-w-44', item: 'justify-start gap-2' })
const styles = tv(slidesPanelTheme)
const base = styles()
const { urls, want } = useSlideThumbnails(store)
const list = useTemplateRef<HTMLElement>('list')

const rows = useSceneComputed(() => slideRows(store.graph, store.state.currentPageId))
const numbers = useSceneComputed(() => slideNumbers(store.graph, store.state.currentPageId))
const slides = computed(() => rows.value.flat())
const onStage = computed(() => store.state.focusedSlideId !== null)
const canEdit = computed(() => {
  const profile = resolveEditorProfile(store.state)
  return profile.edits && profile.layerEdits === 'all'
})

const reorder = useFlatReorderDrag<SceneNode>({
  items: () => slides.value,
  // A dragged slide takes the rest of the selection with it.
  onPlace: (id, slideId, side) => {
    const selected = store.state.selectedIds
    store.moveSlides(selected.has(id) ? selected : [id], { type: 'beside', slideId, side })
  }
})

function dropPosition(id: string): 'before' | 'after' | undefined {
  if (reorder.instructionTargetId.value !== id) return undefined
  if (reorder.instruction.value?.operation === 'reorder-before') return 'before'
  return reorder.instruction.value ? 'after' : undefined
}

/** Sections folded down to their first slide; a view of the deck only, not part of it. */
const collapsed = ref(new Set<string>())
const sectionOf = (slide: SceneNode) => slide.parentId ?? ''

function setCollapsed(section: string, value: boolean) {
  const next = new Set(collapsed.value)
  if (value) next.add(section)
  else next.delete(section)
  collapsed.value = next
}

/** A slide after the first of a folded section. */
function folded(slide: SceneNode, column: number): boolean {
  return column > 0 && collapsed.value.has(sectionOf(slide))
}

// A slide picked elsewhere, as on the canvas or with the arrows, opens the section that hides it.
watch(
  () => [store.state.focusedSlideId, ...store.state.selectedIds],
  (ids) => {
    for (const row of rows.value) {
      if (row.slice(1).some((slide) => ids.includes(slide.id))) {
        setCollapsed(sectionOf(row[0]), false)
      }
    }
  }
)

function rowStyles(slide: SceneNode, column = 0) {
  return styles({
    indented: column > 0,
    selected: isSelected(slide.id),
    skipped: slideSettings(slide)?.skipped ?? false,
    dragging: reorder.draggingId.value === slide.id,
    dropPosition: dropPosition(slide.id)
  })
}

function setupRow(value: Element | ComponentPublicInstance | null, slide: SceneNode) {
  if (canEdit.value) {
    reorder.setupItem(value instanceof HTMLElement ? value : null, () => ({ id: slide.id }))
  }
}

/**
 * The one slide Tab reaches: the first selected or staged one, else the first slide, so the
 * filmstrip can always be entered from the keyboard.
 */
const tabStop = computed(
  () => slides.value.find((slide) => isSelected(slide.id))?.id ?? slides.value.at(0)?.id
)

function isSelected(id: string): boolean {
  return store.state.selectedIds.has(id) || store.state.focusedSlideId === id
}

/** Puts a slide on the stage, or in Grid view brings it into view. */
function show(id: string) {
  if (onStage.value) store.focusSlide(id)
  else store.revealNodes([id])
}

function pick(event: MouseEvent, id: string) {
  if (event.shiftKey) {
    const order = slides.value.map((slide) => slide.id)
    const anchor = order.findIndex((slide) => store.state.selectedIds.has(slide))
    const at = order.indexOf(id)
    const from = anchor === -1 ? at : anchor
    store.select(order.slice(Math.min(from, at), Math.max(from, at) + 1))
    return
  }
  if (event.metaKey || event.ctrlKey) {
    store.select([id], true)
    return
  }
  store.select([id])
  show(id)
}

function step(event: KeyboardEvent, by: 1 | -1) {
  event.preventDefault()
  event.stopPropagation()
  // The arrows pass over the slides a folded section hides, as a tree's rows do.
  const shown = rows.value.flatMap((row) => row.filter((slide, column) => !folded(slide, column)))
  // From the row with focus, which may be the staged slide while a layer on it is selected.
  const from = event.target instanceof HTMLElement ? event.target.dataset.slideId : undefined
  const index = shown.findIndex((slide) =>
    from ? slide.id === from : store.state.selectedIds.has(slide.id)
  )
  const next = shown.at(Math.max(0, index + by))
  if (!next) return
  store.select([next.id])
  show(next.id)
  void nextTick(() =>
    list.value?.querySelector<HTMLElement>(`[data-slide-id="${next.id}"]`)?.focus()
  )
}

/** A right-click acts on the selection it lands in, or selects its own slide. */
function beforeMenu(id: string) {
  if (!store.state.selectedIds.has(id)) store.select([id])
}

const selectedSlides = computed(() =>
  slides.value.filter((slide) => store.state.selectedIds.has(slide.id))
)
const allSkipped = computed(
  () =>
    selectedSlides.value.length > 0 &&
    selectedSlides.value.every((slide) => slideSettings(slide)?.skipped)
)

function toggleSkipped() {
  store.setSlidesSkipped(store.state.selectedIds, !allSkipped.value)
}

function toggleView() {
  if (onStage.value) {
    store.focusSlide(null)
    return
  }
  const slide = selectedSlides.value.at(0) ?? slides.value.at(0)
  if (slide) store.focusSlide(slide.id)
}

watch(
  () => store.state.focusedSlideId,
  (id) =>
    void nextTick(() =>
      list.value?.querySelector(`[data-slide-id="${id}"]`)?.scrollIntoView({ block: 'nearest' })
    )
)

function label(slide: SceneNode): string {
  const number = numbers.value.get(slide.id)
  return number ? messages.value.slideNumber({ number }) : messages.value.skippedSlide
}
</script>

<template>
  <div data-test-id="slides-panel" :class="base.panel()">
    <div :class="base.header()">
      <span :class="base.title()">{{ messages.slides }}</span>
      <IconButton
        :label="onStage ? messages.gridView : messages.slideView"
        data-test-id="slides-toggle-view"
        :disabled="slides.length === 0"
        @click="toggleView"
      >
        <icon-lucide-layout-grid v-if="onStage" class="size-3.5" />
        <icon-lucide-square v-else class="size-3.5" />
      </IconButton>
      <IconButton
        :label="messages.newSlide"
        data-test-id="slides-add"
        :disabled="!canEdit"
        @click="store.addSlide()"
      >
        <icon-lucide-plus class="size-3.5" />
      </IconButton>
    </div>
    <p v-if="slides.length === 0" :class="base.empty()">{{ messages.noSlides }}</p>
    <div
      v-else
      ref="list"
      role="tree"
      aria-multiselectable="true"
      :aria-label="messages.slides"
      :class="base.viewport()"
      @keydown.down="step($event, 1)"
      @keydown.up="step($event, -1)"
    >
      <div v-for="(row, index) in rows" :key="index" role="group" :class="base.section()">
        <template v-for="(slide, column) in row" :key="slide.id">
          <AppContextMenuRoot v-if="!folded(slide, column)" :modal="false">
            <AppContextMenuTrigger as-child>
              <div
                :ref="(value) => setupRow(value, slide)"
                role="treeitem"
                :tabindex="slide.id === tabStop ? 0 : -1"
                :aria-selected="isSelected(slide.id)"
                :aria-label="label(slide)"
                :data-slide-id="slide.id"
                :data-dragging="reorder.draggingId.value === slide.id || undefined"
                :aria-expanded="
                  column === 0 && row.length > 1 ? !collapsed.has(sectionOf(slide)) : undefined
                "
                :class="rowStyles(slide, column).row()"
                @click="pick($event, slide.id)"
                @contextmenu="beforeMenu(slide.id)"
                @keydown.right="
                  column === 0 && row.length > 1 && setCollapsed(sectionOf(slide), false)
                "
                @keydown.left="
                  column === 0 && row.length > 1 && setCollapsed(sectionOf(slide), true)
                "
              >
                <button
                  v-if="column === 0 && row.length > 1"
                  type="button"
                  tabindex="-1"
                  data-test-id="slides-section-toggle"
                  :aria-expanded="!collapsed.has(sectionOf(slide))"
                  :aria-label="
                    collapsed.has(sectionOf(slide))
                      ? messages.expandSection
                      : messages.collapseSection
                  "
                  :class="base.disclosure()"
                  @click.stop="setCollapsed(sectionOf(slide), !collapsed.has(sectionOf(slide)))"
                >
                  <icon-lucide-chevron-right
                    data-direction="reading"
                    :class="base.disclosureIcon()"
                  />
                </button>
                <div v-if="dropPosition(slide.id)" :class="rowStyles(slide).dropIndicator()" />
                <span :class="rowStyles(slide).number()">{{ numbers.get(slide.id) ?? '–' }}</span>
                <div :class="rowStyles(slide).frame()">
                  <SlidesPanelThumbnail
                    :url="urls.get(slide.id)"
                    :width="slide.width"
                    :height="slide.height"
                    :class="rowStyles(slide).image()"
                    @visible="want(slide.id, $event)"
                  />
                  <span :class="rowStyles(slide).marks()">
                    <icon-lucide-eye-off
                      v-if="slideSettings(slide)?.skipped"
                      :class="rowStyles(slide).mark()"
                    />
                    <icon-lucide-sticky-note
                      v-if="slideSettings(slide)?.notes"
                      :class="rowStyles(slide).mark()"
                    />
                    <icon-lucide-chevrons-right
                      v-if="slideSettings(slide)?.transition"
                      data-direction="reading"
                      :class="rowStyles(slide).mark()"
                    />
                  </span>
                </div>
              </div>
            </AppContextMenuTrigger>
            <ContextMenuPortal>
              <ContextMenuContent :class="menuCls.content" :side-offset="2" align="start">
                <MenuScrollArea>
                  <ContextMenuItem
                    :class="menuCls.item"
                    :disabled="!canEdit"
                    @select="store.addSlide(slide.id)"
                  >
                    <icon-lucide-plus :class="menuCls.icon" />
                    <span>{{ messages.newSlide }}</span>
                  </ContextMenuItem>
                  <ContextMenuItem
                    :class="menuCls.item"
                    :disabled="!canEdit"
                    @select="store.duplicateSlides(store.state.selectedIds)"
                  >
                    <icon-lucide-copy :class="menuCls.icon" />
                    <span>{{ messages.duplicate }}</span>
                  </ContextMenuItem>
                  <ContextMenuItem
                    :class="menuCls.item"
                    :disabled="!canEdit"
                    @select="toggleSkipped"
                  >
                    <icon-lucide-eye-off v-if="!allSkipped" :class="menuCls.icon" />
                    <icon-lucide-eye v-else :class="menuCls.icon" />
                    <span>{{ allSkipped ? messages.unskip : messages.skip }}</span>
                  </ContextMenuItem>
                  <ContextMenuItem
                    :class="menuCls.item"
                    :disabled="!canEdit"
                    @select="
                      store.moveSlides(store.state.selectedIds, { type: 'section', before: null })
                    "
                  >
                    <icon-lucide-separator-horizontal :class="menuCls.icon" />
                    <span>{{ messages.moveToNewSection }}</span>
                  </ContextMenuItem>
                  <ContextMenuSeparator :class="menuCls.separator" />
                  <ContextMenuItem
                    :class="menuCls.item"
                    :disabled="!canEdit"
                    @select="store.deleteSlides(store.state.selectedIds)"
                  >
                    <icon-lucide-trash-2 :class="menuCls.icon" />
                    <span>{{ messages.delete }}</span>
                  </ContextMenuItem>
                </MenuScrollArea>
              </ContextMenuContent>
            </ContextMenuPortal>
          </AppContextMenuRoot>
        </template>
      </div>
    </div>
  </div>
</template>
