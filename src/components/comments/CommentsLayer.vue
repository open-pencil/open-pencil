<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
  PopoverContent,
  PopoverPortal,
  PopoverRoot
} from 'reka-ui'
import { computed, ref, useTemplateRef, watch } from 'vue'

import type { ViewportTransform } from '@open-pencil/core/geometry'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { useCommentMessages } from '@open-pencil/vue'

import { useComments } from '@/app/comments/use'
import { useEditorStore } from '@/app/editor/active-store'
import { useMenuUI } from '@/components/ui/menu/menu'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import { COMMENT_PIN_SIZE, comments as commentsTheme } from '@/theme/comments'

import { useCommentAuthor } from './author'
import CommentActionsMenu from './CommentActionsMenu.vue'
import CommentComposer from './CommentComposer.vue'
import CommentPin from './CommentPin.vue'
import CommentThreadCard from './CommentThreadCard.vue'
import { usePinDrag } from './usePinDrag'

const { canvasEl, drawn = null } = defineProps<{
  canvasEl: HTMLCanvasElement | null
  /**
   * The pan and zoom of the canvas's last drawn frame. Pins follow it rather than the live view,
   * which runs ahead of the drawing while panning fast, as preview islands do.
   */
  drawn?: ViewportTransform | null
}>()

/** Room between a card and its pin's bubble. */
const CARD_GAP = 8

const store = useEditorStore()
const comments = useComments()
const messages = useCommentMessages()
const author = useCommentAuthor()
const menuCls = useMenuUI({ content: 'min-w-40' })
const ui = commentsTheme()
const threadCls = usePopoverUI({ content: ui.card() })
const draftCls = usePopoverUI({ content: ui.draftCard() })
const { activeThreadId, draft, showOnCanvas, listShowResolved } = comments
const commenting = computed(() => store.state.activeTool === 'COMMENT')

const draftText = ref('')
const draftComposer = useTemplateRef<{ focus: () => void }>('draftComposer')
const threadCard = useTemplateRef<{ focus: () => void }>('threadCard')

// Picking another tool drops a comment that was never sent, as in Figma.
watch(commenting, (on) => {
  if (!on) draft.value = null
})

const placement = computed<ViewportTransform>(() => drawn ?? store.state)

/** A canvas point in the pins' layer, which panning moves as a whole. */
function toLayer(at: Vector) {
  return { left: at.x * placement.value.zoom, top: at.y * placement.value.zoom }
}

function toScreen(at: Vector) {
  const { left, top } = toLayer(at)
  return { left: left + placement.value.panX, top: top + placement.value.panY }
}

const pinDrag = usePinDrag({
  zoom: () => store.state.zoom,
  onDrop: comments.movePin,
  onClick: comments.toggleThread
})

// Pins show unless View → Comments hid them; the Comment tool always shows them, as in Figma.
const pins = computed(() => {
  // Layers move without the comment changing; re-place pins on every scene change.
  void store.state.sceneVersion
  if (!showOnCanvas.value && !commenting.value) return []
  const pageId = store.state.currentPageId
  return comments.threads.value
    .filter(
      (thread) =>
        !thread.deleted && thread.pageId === pageId && (!thread.resolved || listShowResolved.value)
    )
    .map((thread) => {
      const dragged = pinDrag.draggedTo(thread.id)
      const at = dragged ?? comments.pinPosition(thread)
      return { thread, at, dragging: dragged !== null, ...toLayer(at) }
    })
})

const activePin = computed(() => pins.value.find((pin) => pin.thread.id === activeThreadId.value))
const draftAt = computed(() =>
  draft.value && draft.value.pageId === store.state.currentPageId ? draft.value : null
)
const draftPlace = computed(() => draftAt.value && toLayer(draftAt.value))

// The card sits beside the pin's bubble, which rises above and right of the commented spot,
// on whichever side has room; the bubble's box is what it keeps clear of.
const cardAnchor = computed(() => activePin.value?.at ?? draftAt.value ?? null)
const cardReference = computed(() => {
  const at = cardAnchor.value
  const canvas = canvasEl
  if (!at || !canvas) return null
  const { left, top } = toScreen(at)
  return {
    getBoundingClientRect() {
      const rect = canvas.getBoundingClientRect()
      return new DOMRect(
        rect.left + left,
        rect.top + top - COMMENT_PIN_SIZE,
        COMMENT_PIN_SIZE,
        COMMENT_PIN_SIZE
      )
    }
  }
})

function placeDraft(event: PointerEvent) {
  if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) return
  // With a card open, a click on the canvas only closes it, as in Figma.
  if (comments.closeCard()) return
  const rect = event.currentTarget.getBoundingClientRect()
  const at = store.screenToCanvas(event.clientX - rect.left, event.clientY - rect.top)
  comments.startDraft({ pageId: store.state.currentPageId, ...at })
  draftText.value = ''
}

// Scrolling and zooming keep working over pins and while placing comments, as in Figma.
function forwardWheel(event: WheelEvent) {
  if (!canvasEl) return
  event.preventDefault()
  canvasEl.dispatchEvent(new WheelEvent('wheel', event))
}

function postDraft(text: string) {
  comments.addThread(text)
  draftText.value = ''
}

function focusCard() {
  const card = draftAt.value ? draftComposer.value : threadCard.value
  card?.focus()
}

function onCardOpen(event: Event) {
  event.preventDefault()
  focusCard()
}

// The card stays open when a sent comment becomes its thread or another pin is picked.
const cardKey = computed(() => (draftAt.value ? 'draft' : (activePin.value?.thread.id ?? null)))
watch(cardKey, (key) => key && focusCard(), { flush: 'post' })

// Escape closes the card only; the editor's Escape would leave the Comment tool as well.
function onCardEscape(event: KeyboardEvent) {
  event.stopPropagation()
}

function closeCard() {
  comments.closeCard()
}
</script>

<template>
  <!-- Right-clicks here belong to comments, not to the canvas layer menu underneath; scrolling
       and zooming over pins or while placing comments still reach the canvas. -->
  <div :class="ui.layer()" data-canvas-overlay="comments" @contextmenu.stop @wheel="forwardWheel">
    <div
      v-if="commenting"
      :class="ui.capture()"
      data-slot="comments-capture"
      @pointerdown.prevent="placeDraft"
      @contextmenu.prevent
    />

    <div
      :class="ui.pins()"
      :style="{ transform: `translate(${placement.panX}px, ${placement.panY}px)` }"
    >
      <ContextMenuRoot v-for="pin in pins" :key="pin.thread.id" :modal="false">
        <ContextMenuTrigger as-child>
          <CommentPin
            :author="author.name(pin.thread.author)"
            :color="pin.thread.authorColor"
            :text="pin.thread.text"
            :at="pin.thread.createdAt"
            :active="activeThreadId === pin.thread.id"
            :resolved="pin.thread.resolved"
            :dragging="pin.dragging"
            :style="{ left: `${pin.left}px`, top: `${pin.top}px` }"
            :aria-label="`${author.name(pin.thread.author)}: ${pin.thread.text}`"
            @pointerdown.stop="pinDrag.start($event, pin.thread.id, pin.at)"
            @pointermove="pinDrag.move"
            @pointerup="pinDrag.end"
            @pointercancel="pinDrag.end"
            @click.stop="pinDrag.click(pin.thread.id)"
          />
        </ContextMenuTrigger>
        <ContextMenuPortal>
          <ContextMenuContent :class="menuCls.content">
            <CommentActionsMenu :thread="pin.thread" kind="context" show-hide />
          </ContextMenuContent>
        </ContextMenuPortal>
      </ContextMenuRoot>

      <CommentPin
        v-if="draftPlace"
        draft
        :style="{ left: `${draftPlace.left}px`, top: `${draftPlace.top}px` }"
        aria-hidden="true"
        tabindex="-1"
      />
    </div>

    <PopoverRoot
      :open="!!cardReference && (!!activePin || !!draftAt)"
      @update:open="(open: boolean) => !open && closeCard()"
    >
      <PopoverPortal>
        <PopoverContent
          v-if="cardReference"
          :reference="cardReference"
          side="right"
          :align="draftAt ? 'center' : 'start'"
          :side-offset="CARD_GAP"
          :collision-padding="8"
          :class="draftAt ? draftCls.content : threadCls.content"
          data-canvas-obstacle
          @open-auto-focus="onCardOpen"
          @escape-key-down="onCardEscape"
        >
          <CommentComposer
            v-if="draftAt"
            ref="draftComposer"
            v-model="draftText"
            bare
            :label="messages.addComment"
            @submit="postDraft"
            @cancel="closeCard"
          />
          <CommentThreadCard
            v-else-if="activePin"
            ref="threadCard"
            :thread="activePin.thread"
            @close="closeCard"
            @resolve="comments.setResolved"
            @reply="comments.reply"
            @delete-reply="comments.deleteReply"
          >
            <template #menu>
              <CommentActionsMenu :thread="activePin.thread" kind="dropdown" />
            </template>
          </CommentThreadCard>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>
