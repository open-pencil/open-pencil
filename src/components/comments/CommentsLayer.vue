<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ContextMenuContent, ContextMenuPortal, PopoverContent, PopoverPortal } from 'reka-ui'
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'

import type { ViewportTransform } from '@open-pencil/core/geometry'
import type { CommentThread } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { useCommentMessages } from '@open-pencil/vue/i18n'

import { commentPreview } from '@/app/comments/format'
import { useComments } from '@/app/comments/use'
import { useEditorStore } from '@/app/editor/active-store'
import AppContextMenuRoot from '@/components/ui/menu/AppContextMenuRoot.vue'
import AppContextMenuTrigger from '@/components/ui/menu/AppContextMenuTrigger.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'
import AppPopoverRoot from '@/components/ui/overlay/AppPopoverRoot.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import { COMMENT_PIN_SIZE } from '@/theme/comments'

import { useCommentAuthor } from './author'
import CommentActionsMenu from './CommentActionsMenu.vue'
import CommentComposer from './CommentComposer.vue'
import CommentPin from './CommentPin.vue'
import CommentThreadCard from './CommentThreadCard.vue'
import { comments as commentsTheme } from './ui'
import { clusterView, usePinClusters, type PinCluster } from './usePinClusters'
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
const { canComment } = comments

/** Whether the open thread's reply may be deleted here. */
function canDeleteReply(replyId: string): boolean {
  const thread = activePin.value?.thread
  return !!thread && comments.canDelete(thread.id, replyId)
}

/** What a pin says to assistive technology: who wrote what, and whether it is new to you. */
function pinLabel(thread: CommentThread): string {
  const label = `${author.name(thread.author)}: ${commentPreview(thread.text)}`
  return comments.isUnread(thread.id) ? `${messages.value.unread}, ${label}` : label
}
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
      const dragging = dragged !== null
      const standalone =
        pinDrag.pressed(thread.id) || dragging || thread.id === activeThreadId.value
      return { thread, at, dragging, standalone, ...toLayer(at) }
    })
})

const { pins: shownPins, clusters } = usePinClusters(pins)

const pinsLayer = useTemplateRef<HTMLElement>('pinsLayer')

/**
 * A cluster's click zooms in on its pins until they part, as in Figma. Focus on the cluster,
 * which the zoom removes, moves to its first pin, or to the cluster that pin is in now.
 */
function openCluster(event: MouseEvent, cluster: PinCluster<(typeof pins.value)[number]>) {
  const button = event.currentTarget
  if (button instanceof HTMLElement && document.activeElement === button) {
    handFocusOnSplit(button, cluster)
  }
  const { bounds, maxZoom } = clusterView(cluster)
  store.zoomToBounds(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height, {
    maxZoom
  })
}

/**
 * Moves focus from a cluster to its first pin once the cluster is gone, which can be a drawn
 * frame later; focus the user moved elsewhere in the meantime stays where they put it.
 */
let pendingHandoff: (() => void) | null = null
onBeforeUnmount(() => pendingHandoff?.())

function handFocusOnSplit(button: HTMLElement, cluster: PinCluster<{ thread: { id: string } }>) {
  pendingHandoff?.()
  const stop = watch(
    clusters,
    (next) => {
      if (next.some((other) => other.key === cluster.key)) {
        if (document.activeElement !== button) pendingHandoff?.()
        return
      }
      pendingHandoff?.()
      // Removing the cluster drops focus to the page; focus anywhere else was the user's move.
      if (document.activeElement && document.activeElement !== document.body) return
      const id = CSS.escape(cluster.pins[0].thread.id)
      pinsLayer.value
        ?.querySelector<HTMLElement>(`[data-thread-id="${id}"], [data-cluster~="${id}"]`)
        ?.focus()
    },
    { flush: 'post' }
  )
  pendingHandoff = () => {
    stop()
    pendingHandoff = null
  }
}

function clusterLabel(count: number) {
  return messages.value.clusterCount({ count })
}

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
  if (!commenting.value || event.button !== 0 || !canvasEl) return
  event.preventDefault()
  // With a card open, a click on the canvas only closes it, as in Figma.
  if (comments.closeCard()) return
  const rect = canvasEl.getBoundingClientRect()
  const at = store.screenToCanvas(event.clientX - rect.left, event.clientY - rect.top)
  comments.startDraft({ pageId: store.state.currentPageId, ...at })
  draftText.value = ''
}

// The canvas places drafts itself, so its other buttons keep panning and opening the layer menu.
useEventListener(() => canvasEl, 'pointerdown', placeDraft)

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

function closeCard() {
  comments.closeCard()
}
</script>

<template>
  <!-- Right-clicks here belong to comments, not to the canvas layer menu underneath; scrolling
       and zooming over pins or while placing comments still reach the canvas. -->
  <div :class="ui.layer()" data-canvas-overlay="comments" @contextmenu.stop @wheel="forwardWheel">
    <div
      ref="pinsLayer"
      :class="ui.pins()"
      :style="{ transform: `translate(${placement.panX}px, ${placement.panY}px)` }"
    >
      <!-- Before the pins, so an open or dragged pin a cluster sits over stays on top. -->
      <button
        v-for="cluster in clusters"
        :key="cluster.key"
        type="button"
        :class="ui.cluster()"
        :style="{ left: `${cluster.left}px`, top: `${cluster.top}px` }"
        :aria-label="clusterLabel(cluster.pins.length)"
        :data-cluster="cluster.key"
        data-slot="comment-cluster"
        @pointerdown.stop
        @mousedown.prevent
        @click.stop="openCluster($event, cluster)"
      >
        {{ cluster.pins.length }}
      </button>

      <AppContextMenuRoot v-for="pin in shownPins" :key="pin.thread.id" :modal="false">
        <AppContextMenuTrigger as-child>
          <CommentPin
            :author="author.name(pin.thread.author)"
            :color="pin.thread.authorColor"
            :text="pin.thread.text"
            :at="pin.thread.createdAt"
            :active="activeThreadId === pin.thread.id"
            :resolved="pin.thread.resolved"
            :dragging="pin.dragging"
            :unread="comments.isUnread(pin.thread.id)"
            :style="{ left: `${pin.left}px`, top: `${pin.top}px` }"
            :aria-label="pinLabel(pin.thread)"
            :data-thread-id="pin.thread.id"
            @pointerdown.stop="pinDrag.start($event, pin.thread.id, pin.at)"
            @pointermove="pinDrag.move"
            @pointerup="pinDrag.end"
            @pointercancel="pinDrag.end"
            @lostpointercapture="pinDrag.end"
            @click.stop="pinDrag.click(pin.thread.id)"
          />
        </AppContextMenuTrigger>
        <ContextMenuPortal>
          <ContextMenuContent :class="menuCls.content">
            <MenuScrollArea>
              <CommentActionsMenu :thread="pin.thread" kind="context" show-hide />
            </MenuScrollArea>
          </ContextMenuContent>
        </ContextMenuPortal>
      </AppContextMenuRoot>

      <CommentPin
        v-if="draftPlace"
        draft
        :style="{ left: `${draftPlace.left}px`, top: `${draftPlace.top}px` }"
        aria-hidden="true"
        tabindex="-1"
      />
    </div>

    <AppPopoverRoot
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
        >
          <CommentComposer
            v-if="draftAt"
            ref="draftComposer"
            v-model="draftText"
            bare
            :label="messages.addComment"
            :mentionable="comments.mentionable"
            @submit="postDraft"
            @cancel="closeCard"
          />
          <CommentThreadCard
            v-else-if="activePin"
            ref="threadCard"
            :thread="activePin.thread"
            :read-only="!canComment"
            :mentionable="comments.mentionable"
            :can-delete-reply="canDeleteReply"
            @close="closeCard"
            @resolve="comments.setResolved"
            @reply="comments.reply"
            @delete-reply="comments.deleteReply"
          >
            <template v-if="canComment" #menu>
              <CommentActionsMenu :thread="activePin.thread" kind="dropdown" />
            </template>
          </CommentThreadCard>
        </PopoverContent>
      </PopoverPortal>
    </AppPopoverRoot>
  </div>
</template>
