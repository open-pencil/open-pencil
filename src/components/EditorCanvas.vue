<script setup lang="ts">
import {
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
  PopoverContent,
  PopoverPortal,
  PopoverRoot
} from 'reka-ui'
import { computed, onUnmounted, ref, shallowRef, useTemplateRef, watch, type Component } from 'vue'
import IconLucidePanelBottom from '~icons/lucide/panel-bottom'
import IconLucidePanelLeft from '~icons/lucide/panel-left'
import IconLucidePanelRight from '~icons/lucide/panel-right'
import IconLucidePanelTop from '~icons/lucide/panel-top'

import {
  AUTO_LAYOUT_PADDING_EDITOR_OFFSET_X,
  AUTO_LAYOUT_PADDING_EDITOR_OFFSET_Y,
  COMPONENT_LABEL_ICON_GAP,
  COMPONENT_LABEL_ICON_SIZE,
  SECTION_TITLE_GAP,
  SECTION_TITLE_HEIGHT
} from '@open-pencil/core/constants'
import type { ViewportTransform } from '@open-pencil/core/geometry'
import {
  PlayIslands,
  toolCursor,
  useCanvas,
  useCanvasDrop,
  useCanvasInput,
  useCanvasIssueMarkers,
  useCanvasVirtualReference,
  useTextEdit
} from '@open-pencil/vue'

import { useAIChat } from '@/app/ai/chat/use'
import { useEditorStore } from '@/app/editor/active-store'
import { useCanvasCollaborationAwareness } from '@/app/editor/canvas/collaboration-awareness'
import { createCanvasContextSelection } from '@/app/editor/canvas/context-selection'
import { canvasOverlayObstacles } from '@/app/editor/canvas/obstacles'
import { useFollowView } from '@/app/presence/follow-view'
import { appRuntimeConfig } from '@/app/runtime/config'
import CommentsLayer from '@/components/comments/CommentsLayer.vue'
import IssueMarkerTooltip from '@/components/design-check/IssueMarkerTooltip.vue'
import PreparationOverlay from '@/components/preparation/canvas/Overlay.vue'
import FollowFrame from '@/components/presence/FollowFrame.vue'
import AppDropOverlay from '@/components/ui/feedback/AppDropOverlay.vue'
import { motionStyles } from '@/theme/motion/styles'
import { floatingSurface } from '@/theme/overlay'

import CanvasMenu from './canvas/CanvasMenu.vue'
import CanvasLabelEditor from './canvas/labels/CanvasLabelEditor.vue'
import { canvasLabelPresentation } from './canvas/labels/presentation'
import NumberField from './inputs/NumberField.vue'

const { paneId } = defineProps<{
  paneId?: string
}>()

const store = useEditorStore()
const sceneCanvasRef = ref<HTMLCanvasElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const isActivePane = computed(() => !paneId || store.activePaneId.value === paneId)
const followView = useFollowView(useTemplateRef<HTMLElement>('area'))

function activatePane() {
  if (paneId) store.setActivePane(paneId)
}

function updatePaneCursor(cx: number, cy: number) {
  if (isActivePane.value) updateCursor(cx, cy)
}

const getRenderState = paneId ? () => store.getPaneRenderState(paneId) : undefined
/** This pane's view: its pan, zoom, page, and whether it previews. */
const paneView = computed(() => (paneId ? store.getPaneRenderState(paneId) : store.state))
const onViewportResize = (width: number, height: number) => {
  if (paneId) store.resizePane(paneId, width, height)
  if (isActivePane.value) store.setViewportSize(width, height)
}

const { updateCursor } = useCanvasCollaborationAwareness(store)
const { selectAtContextPoint } = createCanvasContextSelection(canvasRef, store)

const shouldSuspendRender = () =>
  store.state.preparation !== null &&
  store.state.preparation.kind !== 'font-retry' &&
  store.state.preparation.phase !== 'preparing-render'

/** The pan and zoom of the scene's last drawn frame, which preview islands follow. */
const drawnView = shallowRef<ViewportTransform | null>(null)

useCanvas(sceneCanvasRef, store, {
  layer: 'scene',
  onFrame: (view) => {
    drawnView.value = view
  },
  sceneRenderer: appRuntimeConfig.sceneRenderer,
  onReady: store.markCanvasReady,
  shouldSuspendRender,
  showRulers: false,
  getRenderState,
  onViewportResize,
  onPresented: ({ sceneVersion }) =>
    store.preparationController.acknowledgePresentation(sceneVersion),
  onPresentation: (colorSpace) => {
    store.state.canvasPresentation = colorSpace
  }
})
const { hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle, hitTestIssueMarker } =
  useCanvas(canvasRef, store, {
    layer: 'overlays',
    get showRulers() {
      return appRuntimeConfig.showRulers && store.state.showRulers && paneView.value.play === null
    },
    getOverlayObstacles: () => canvasOverlayObstacles(canvasRef.value),
    shouldSuspendRender,
    getRenderState,
    onViewportResize
  })
const {
  cursorOverride,
  canvasLabelEdit,
  updateCanvasLabelEdit,
  commitCanvasLabelEdit,
  cancelCanvasLabelEdit,
  autoLayoutPaddingEdit,
  updateAutoLayoutPaddingEdit,
  commitAutoLayoutPaddingEdit,
  cancelAutoLayoutPaddingEdit,
  cleanupInteractions
} = useCanvasInput(
  canvasRef,
  store,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
  updatePaneCursor,
  activatePane,
  () => isActivePane.value
)

watch(isActivePane, (active) => {
  if (!active) cleanupInteractions()
})
onUnmounted(cleanupInteractions)

const { activeTab: propertiesTab } = useAIChat()
const { detailMarker: hoveredIssueMarker, cursor: issueMarkerCursor } = useCanvasIssueMarkers(
  canvasRef,
  store,
  {
    hitTest: hitTestIssueMarker,
    onHover: (marker) => store.designCheck.highlightMarker(marker?.nodeIds ?? null),
    onActivate: (marker) => {
      activatePane()
      propertiesTab.value = 'lint'
      // An edge pin leads to its nearest issue; a marker opens every layer it covers.
      const nodeIds = marker.direction ? marker.nodeIds.slice(0, 1) : marker.nodeIds
      store.designCheck.openMarker(nodeIds)
      if (marker.direction) store.revealNodes(nodeIds)
    }
  }
)

useTextEdit(canvasRef, store, { isEnabled: () => isActivePane.value })
const { isDraggingOver } = useCanvasDrop(canvasRef, store, activatePane)

const paddingSideIcons = {
  top: IconLucidePanelTop,
  right: IconLucidePanelRight,
  bottom: IconLucidePanelBottom,
  left: IconLucidePanelLeft
} satisfies Record<'top' | 'right' | 'bottom' | 'left', Component>

const canvasLabelEditNode = computed(() => {
  const edit = canvasLabelEdit.value
  return edit ? store.graph.getNode(edit.nodeId) : null
})
const canvasLabelEditAnchor = computed(() => {
  const node = canvasLabelEditNode.value
  if (!node) return null
  const origin = store.graph.getAbsolutePosition(node.id)
  const { zoom, panX, panY } = store.state
  const kind = canvasLabelEdit.value?.kind
  // The canvas starts an upright label on a whole screen pixel; the field starts on the same one.
  const abs = {
    x: (Math.round(origin.x * zoom + panX) - panX) / zoom,
    y: (Math.round(origin.y * zoom + panY) - panY) / zoom
  }
  // A component's name starts after its diamond, which keeps its screen size at any zoom.
  if (kind === 'component-label')
    return { x: abs.x + (COMPONENT_LABEL_ICON_SIZE + COMPONENT_LABEL_ICON_GAP) / zoom, y: abs.y }
  // A section inside another draws its title inside its top-left corner instead of above it.
  const nested = node.parentId && store.graph.closest(node.parentId, (n) => n.type === 'SECTION')
  if (kind === 'section-title' && nested) {
    const inset = SECTION_TITLE_GAP / zoom
    return {
      x: abs.x + inset,
      y: abs.y + inset + (SECTION_TITLE_HEIGHT + SECTION_TITLE_GAP) / zoom
    }
  }
  return { x: abs.x, y: abs.y }
})
const canvasLabelEditReference = useCanvasVirtualReference(canvasRef, store, canvasLabelEditAnchor)
const canvasLabelEditPresentation = computed(() =>
  canvasLabelPresentation(store, canvasLabelEditNode.value ?? null, canvasLabelEdit.value?.kind)
)

const paddingEditorAnchor = computed(() => {
  const edit = autoLayoutPaddingEdit.value
  if (!edit) return null
  const node = store.graph.getNode(edit.nodeId)
  if (!node) return null
  const abs = store.graph.getAbsolutePosition(node.id)
  if (edit.side === 'top') return { x: abs.x + node.width / 2, y: abs.y + node.paddingTop / 2 }
  if (edit.side === 'bottom') {
    return { x: abs.x + node.width / 2, y: abs.y + node.height - node.paddingBottom / 2 }
  }
  if (edit.side === 'left') return { x: abs.x + node.paddingLeft / 2, y: abs.y + node.height / 2 }
  return { x: abs.x + node.width - node.paddingRight / 2, y: abs.y + node.height / 2 }
})
const paddingEditorReference = useCanvasVirtualReference(canvasRef, store, paddingEditorAnchor)
const paddingEditorIcon = computed(() => {
  const edit = autoLayoutPaddingEdit.value
  return edit ? paddingSideIcons[edit.side] : IconLucidePanelTop
})

const cursor = computed(() =>
  toolCursor(store.state.activeTool, issueMarkerCursor.value ?? cursorOverride.value)
)
</script>

<template>
  <ContextMenuRoot :modal="false">
    <ContextMenuTrigger as-child @contextmenu.capture="selectAtContextPoint">
      <div
        ref="area"
        data-test-id="canvas-area"
        :data-pane-id="paneId"
        :data-active-pane="isActivePane ? 'true' : 'false'"
        class="canvas-area relative min-h-0 min-w-0 flex-1 overflow-hidden"
        @pointerdown.capture="activatePane"
        @focusin.capture="activatePane"
        @wheel.capture="activatePane"
        @dragenter.capture="activatePane"
      >
        <canvas
          ref="sceneCanvasRef"
          :data-pane-id="paneId"
          data-test-id="scene-canvas-element"
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 size-full outline-none"
        />
        <canvas
          ref="canvasRef"
          :data-pane-id="paneId"
          data-test-id="canvas-element"
          tabindex="-1"
          :style="{ cursor }"
          class="absolute inset-0 block size-full touch-none outline-none"
        />
        <PlayIslands :view="paneView" :drawn="drawnView" :canvas="canvasRef" />
        <AppDropOverlay :visible="isDraggingOver" />
        <IssueMarkerTooltip :marker="hoveredIssueMarker" :canvas="canvasRef" />
        <CanvasLabelEditor
          :edit="canvasLabelEdit"
          :presentation="canvasLabelEditPresentation"
          :reference="canvasLabelEditReference"
          @update="updateCanvasLabelEdit"
          @commit="commitCanvasLabelEdit"
          @cancel="cancelCanvasLabelEdit"
        />
        <PopoverRoot :open="!!autoLayoutPaddingEdit">
          <PopoverPortal>
            <PopoverContent
              v-if="autoLayoutPaddingEdit && paddingEditorReference"
              :reference="paddingEditorReference"
              side="top"
              align="center"
              :side-offset="AUTO_LAYOUT_PADDING_EDITOR_OFFSET_Y"
              :align-offset="AUTO_LAYOUT_PADDING_EDITOR_OFFSET_X"
              :collision-padding="8"
              :class="['z-50 w-20 p-1', floatingSurface, motionStyles.floating]"
              data-test-id="auto-layout-padding-editor"
              @keydown.escape.prevent="cancelAutoLayoutPaddingEdit"
              @open-auto-focus.prevent
            >
              <NumberField
                :model-value="autoLayoutPaddingEdit.value"
                :min="0"
                :step="1"
                data-test-id="auto-layout-padding-input"
                @update:model-value="updateAutoLayoutPaddingEdit"
                @commit="(value: number) => commitAutoLayoutPaddingEdit(value)"
                @editing-change="
                  (editing: boolean) =>
                    !editing &&
                    autoLayoutPaddingEdit &&
                    commitAutoLayoutPaddingEdit(autoLayoutPaddingEdit.value)
                "
              >
                <template #icon>
                  <component :is="paddingEditorIcon" class="size-3.5" />
                </template>
              </NumberField>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <FollowFrame
          v-if="isActivePane && followView.label.value"
          :followed="followView.label.value"
          @stop="followView.stop"
        />
        <CommentsLayer v-if="isActivePane" :canvas-el="canvasRef" :drawn="drawnView" />
        <PreparationOverlay
          v-if="store.state.preparation && store.state.preparation.kind !== 'font-retry'"
          :preparation="store.state.preparation"
        />
      </div>
    </ContextMenuTrigger>

    <ContextMenuPortal>
      <CanvasMenu />
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
