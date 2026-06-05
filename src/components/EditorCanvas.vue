<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useRoute } from 'vue-router'
import {
  AUTO_LAYOUT_PADDING_EDITOR_OFFSET_X,
  AUTO_LAYOUT_PADDING_EDITOR_OFFSET_Y
} from '@inkly/core/constants'
import type { SceneNode } from '@inkly/core/scene-graph'
import { adjustRunsForDelete, adjustRunsForInsert } from '@inkly/core/text'
import {
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
  PopoverContent,
  PopoverPortal,
  PopoverRoot
} from 'reka-ui'

import {
  toolCursor,
  useCanvas,
  useCanvasDrop,
  useCanvasInput,
  useCanvasVirtualReference,
  useTextEdit
} from '@inkly/vue'
import { listBoards } from '@/app/api/client'
import { createMentionNotification } from '@/app/api/notifications'
import { getTeam } from '@/app/api/teams'
import { useAuthStore } from '@/app/auth/store'
import { useCollabInjected } from '@/app/collab/use'
import { useEditorStore } from '@/app/editor/active-store'
import { useCanvasCollaborationAwareness } from '@/app/editor/canvas/collaboration-awareness'
import { toast } from '@/app/shell/ui'
import { createCanvasContextSelection } from '@/app/editor/canvas/context-selection'
import { fadeOutGlobalLoader } from '@/app/editor/canvas/loader-overlay'
import IconLucidePanelBottom from '~icons/lucide/panel-bottom'
import IconLucidePanelLeft from '~icons/lucide/panel-left'
import IconLucidePanelRight from '~icons/lucide/panel-right'
import IconLucidePanelTop from '~icons/lucide/panel-top'
import CanvasMenu from './CanvasMenu.vue'
import MentionInput from './MentionInput.vue'
import ScrubInput from './ScrubInput.vue'

const store = useEditorStore()
const auth = useAuthStore()
const collab = useCollabInjected()
const route = useRoute()
const sceneCanvasRef = ref<HTMLCanvasElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const { updateCursor } = useCanvasCollaborationAwareness(store, collab)
const { selectAtContextPoint } = createCanvasContextSelection(canvasRef, store)

useCanvas(sceneCanvasRef, store, {
  layer: 'scene',
  showRulers: false,
  onReady: fadeOutGlobalLoader
})
const { hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle } = useCanvas(
  canvasRef,
  store,
  {
    layer: 'overlays'
  }
)
const {
  cursorOverride,
  autoLayoutPaddingEdit,
  updateAutoLayoutPaddingEdit,
  commitAutoLayoutPaddingEdit,
  cancelAutoLayoutPaddingEdit
} = useCanvasInput(
  canvasRef,
  store,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle,
  updateCursor
)

useTextEdit(canvasRef, store)

const { isDraggingOver } = useCanvasDrop(canvasRef, store, (file: File) => {
  import('@/app/tabs').then(({ openFileInNewTab }) => {
    void openFileInNewTab(file)
  })
})

const paddingSideIcons = {
  top: IconLucidePanelTop,
  right: IconLucidePanelRight,
  bottom: IconLucidePanelBottom,
  left: IconLucidePanelLeft
} satisfies Record<'top' | 'right' | 'bottom' | 'left', Component>

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

type MentionCandidate = {
  id: string
  name: string
  email: string
  image: string | null
}

type ActiveMention = {
  end: number
  query: string
  start: number
}

const mentionCandidates = ref<MentionCandidate[]>([])
const mentionCandidatesLoading = ref(false)
const activeMentionIndex = ref(0)
const dismissedMentionKey = ref<string | null>(null)

const boardId = computed(() =>
  typeof route.query.board === 'string' && route.query.board.length > 0 ? route.query.board : null
)
const activeMention = computed<ActiveMention | null>(() => {
  const renderVersion = store.state.renderVersion
  void renderVersion

  if (!auth.isAuthenticated || !store.state.editingTextId) return null
  const textEditor = store.textEditor
  const state = textEditor?.state
  if (!state || textEditor.hasSelection()) return null

  const prefix = state.text.slice(0, state.cursor)
  const match = prefix.match(/(^|[\s([{'"`])@([^\s@]*)$/)
  if (!match) return null

  const query = match[2] ?? ''
  const start = state.cursor - query.length - 1
  return {
    start,
    end: state.cursor,
    query
  }
})
const activeMentionKey = computed(() => {
  if (!store.state.editingTextId || !activeMention.value) return null
  return `${store.state.editingTextId}:${activeMention.value.start}:${activeMention.value.end}:${activeMention.value.query}`
})
const filteredMentionCandidates = computed(() => {
  const query = activeMention.value?.query.trim().toLowerCase() ?? ''
  if (!query) return mentionCandidates.value
  return mentionCandidates.value.filter((candidate) => {
    const name = candidate.name.trim().toLowerCase()
    const email = candidate.email.trim().toLowerCase()
    return name.includes(query) || email.includes(query)
  })
})
const mentionOpen = computed(
  () => !!activeMention.value && activeMentionKey.value !== dismissedMentionKey.value
)
const mentionAnchor = computed(() => {
  const renderVersion = store.state.renderVersion
  void renderVersion

  const editingTextId = store.state.editingTextId
  const node = editingTextId ? store.graph.getNode(editingTextId) : null
  const caret = store.textEditor?.getCaretRect()
  if (!editingTextId || !node) return null

  const abs = store.graph.getAbsolutePosition(editingTextId)
  if (!caret) {
    return {
      x: abs.x,
      y: abs.y + node.height
    }
  }

  return {
    x: abs.x + caret.x,
    y: abs.y + caret.y1
  }
})
const mentionReference = useCanvasVirtualReference(canvasRef, store, mentionAnchor)

function mapCandidate(raw: MentionCandidate) {
  return {
    id: raw.id,
    name: raw.name.trim() || raw.email,
    email: raw.email,
    image: raw.image
  }
}

async function loadMentionCandidates() {
  if (!auth.isAuthenticated || !boardId.value) {
    mentionCandidates.value = []
    mentionCandidatesLoading.value = false
    return
  }

  mentionCandidatesLoading.value = true

  try {
    const boards = await listBoards()
    const board = boards.find((candidate) => candidate.id === boardId.value) ?? null
    if (!board?.teamId) {
      mentionCandidates.value = []
      return
    }

    const team = await getTeam(board.teamId)
    mentionCandidates.value = team.members
      .map((member) => mapCandidate(member.user))
      .filter((candidate) => candidate.id !== auth.user?.id)
  } catch (error) {
    console.warn('[mentions]', error)
    mentionCandidates.value = []
  } finally {
    mentionCandidatesLoading.value = false
  }
}

function replaceActiveMentionText(candidate: MentionCandidate) {
  const mention = activeMention.value
  const editingTextId = store.state.editingTextId
  const node = editingTextId ? store.graph.getNode(editingTextId) : null
  const textEditor = store.textEditor
  const textEditorState = textEditor?.state
  if (!mention || !node || !textEditor || !textEditorState) return null

  const replacement = `@${candidate.email} `
  let runs = node.styleRuns
  runs = adjustRunsForDelete(runs, mention.start, mention.end - mention.start)
  runs = adjustRunsForInsert(runs, mention.start, replacement.length)

  textEditorState.selectionAnchor = mention.start
  textEditorState.cursor = mention.end
  textEditor.insert(replacement, node)

  const text = textEditor.state?.text ?? ''
  const changes: Partial<SceneNode> = { text }
  if (runs !== undefined) changes.styleRuns = runs
  store.graph.updateNode(node.id, changes)
  store.requestRender()
  return text
}

async function selectMentionCandidate(candidateId: string) {
  const candidate = mentionCandidates.value.find((item) => item.id === candidateId) ?? null
  if (!candidate || !boardId.value || !auth.user?.id) return

  const updatedText = replaceActiveMentionText(candidate)
  dismissedMentionKey.value = null
  if (!updatedText) return

  try {
    await createMentionNotification({
      boardId: boardId.value,
      mentionedUserId: candidate.id,
      sourceUserId: auth.user.id,
      text: updatedText
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send mention notification'
    toast.error(message)
  }
}

function setActiveMentionIndex(index: number) {
  activeMentionIndex.value = index
}

watch(
  [boardId, () => auth.user?.id ?? null],
  () => {
    void loadMentionCandidates()
  },
  { immediate: true }
)

watch(activeMentionKey, (key, previousKey) => {
  if (key !== previousKey) {
    activeMentionIndex.value = 0
    dismissedMentionKey.value = null
  }
})

watch(filteredMentionCandidates, (candidates) => {
  if (candidates.length === 0) {
    activeMentionIndex.value = 0
    return
  }

  activeMentionIndex.value = Math.min(activeMentionIndex.value, candidates.length - 1)
})

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (!mentionOpen.value) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeMentionIndex.value =
      (activeMentionIndex.value + 1) % Math.max(filteredMentionCandidates.value.length, 1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    const length = Math.max(filteredMentionCandidates.value.length, 1)
    activeMentionIndex.value = (activeMentionIndex.value - 1 + length) % length
    return
  }

  if (event.key === 'Enter' || event.key === 'Tab') {
    const candidate = filteredMentionCandidates.value[activeMentionIndex.value]
    if (!candidate) return
    event.preventDefault()
    void selectMentionCandidate(candidate.id)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    dismissedMentionKey.value = activeMentionKey.value
  }
})

const cursor = computed(() => toolCursor(store.state.activeTool, cursorOverride.value))
</script>

<template>
  <ContextMenuRoot :modal="false">
    <ContextMenuTrigger as-child @contextmenu="selectAtContextPoint">
      <div
        data-test-id="canvas-area"
        class="canvas-area relative min-h-0 min-w-0 flex-1 overflow-hidden"
      >
        <canvas
          ref="sceneCanvasRef"
          data-test-id="scene-canvas-element"
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 size-full outline-none"
        />
        <canvas
          ref="canvasRef"
          data-test-id="canvas-element"
          tabindex="-1"
          :style="{ cursor }"
          class="absolute inset-0 block size-full touch-none outline-none"
        />
        <Transition
          enter-active-class="transition-opacity duration-150"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-150"
          leave-to-class="opacity-0"
        >
          <div
            v-if="isDraggingOver"
            class="pointer-events-none absolute inset-0 z-40 border-2 border-dashed border-accent/60 bg-accent/5"
          />
        </Transition>
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
              class="z-50 w-20 rounded-md bg-panel p-1 shadow-lg"
              data-test-id="auto-layout-padding-editor"
              @keydown.escape.prevent="cancelAutoLayoutPaddingEdit"
              @open-auto-focus.prevent
            >
              <ScrubInput
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
              </ScrubInput>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <PopoverRoot :open="mentionOpen">
          <PopoverPortal>
            <PopoverContent
              v-if="mentionOpen && mentionReference"
              :reference="mentionReference"
              side="bottom"
              align="start"
              :side-offset="10"
              :collision-padding="8"
              class="z-50 p-0 outline-none"
              @open-auto-focus.prevent
            >
              <MentionInput
                :query="activeMention?.query ?? ''"
                :candidates="filteredMentionCandidates"
                :active-index="activeMentionIndex"
                :loading="mentionCandidatesLoading"
                @hover="setActiveMentionIndex"
                @select="selectMentionCandidate"
              />
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <Transition leave-active-class="transition-opacity duration-300" leave-to-class="opacity-0">
          <div
            v-if="store.state.loading"
            data-test-id="canvas-loading"
            class="absolute inset-0 z-50 flex items-center justify-center bg-canvas"
          >
            <svg
              class="size-8 text-surface opacity-45"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="m15.232 5.232 3.536 3.536m-2.036-5.036a2.5 2.5 0 0 1 3.536 3.536L6.5 21.036H3v-3.572L16.732 3.732Z"
              />
            </svg>
            <div
              class="absolute bottom-1/2 left-1/2 h-0.5 w-25 -translate-x-1/2 translate-y-10 overflow-hidden rounded-full bg-surface/8"
            >
              <div
                class="h-full w-2/5 animate-[slide_1s_ease-in-out_infinite] rounded-full bg-surface/25"
              />
            </div>
          </div>
        </Transition>
      </div>
    </ContextMenuTrigger>

    <ContextMenuPortal>
      <CanvasMenu />
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
