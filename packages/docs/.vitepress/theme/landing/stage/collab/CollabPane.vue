<script setup lang="ts">
import { until, useMediaQuery } from '@vueuse/core'
import { onMounted, onScopeDispose, shallowRef } from 'vue'
import IconSparkles from '~icons/lucide/sparkles'

import { colorToCSS } from '@open-pencil/scene-graph/color'

import type { useCollabIdentity } from '@/app/collab/identity'
import { openRoomSession, type RoomSession } from '@/app/collab/session'
import type { JoinCollabRoom } from '@/app/collab/transport'
import type { EditorStore } from '@/app/editor/active-store'
import AppButton from '@/components/ui/button/AppButton.vue'

import { useLandingMessages } from '#docs/theme/landing/content/messages'

import { useRecordedChat } from '../ai/useRecordedChat'
import { SCENES } from '../scenes'
import StageCanvas from '../StageCanvas.vue'
import { useStageDocument } from '../useStageDocument'
import { useWheelEngagement } from '../useWheelEngagement'

const {
  role,
  joinRoom,
  roomId,
  identity,
  label
} = defineProps<{
  /** The host shares its document into the room; the guest opens it from there. */
  role: 'host' | 'guest'
  joinRoom: JoinCollabRoom
  roomId: string
  identity: Pick<ReturnType<typeof useCollabIdentity>, 'name' | 'color'>
  label: string
}>()

const messages = useLandingMessages()
const session = shallowRef<RoomSession | null>(null)

/** Nothing about a landing room should outlive the page, so its copy stays in memory. */
const memoryCopy = () => ({ whenSynced: Promise.resolve(), destroy: () => undefined })

function openRoom(store: EditorStore, origin: 'shared' | 'joined'): RoomSession {
  const opened = openRoomSession({ roomId, store, origin, joinRoom, identity, openSavedCopy: memoryCopy })
  session.value = opened
  return opened
}

async function hostScene(store: EditorStore): Promise<void> {
  await SCENES.pricing(store)
  openRoom(store, 'shared').shareDocument()
}

/** The guest waits for the host's document, as a teammate opening a shared link would. */
async function guestScene(store: EditorStore): Promise<void> {
  const joined = openRoom(store, 'joined')
  await until(joined.hasDocument).toBe(true)
  // The document arrives before its layers reach the page on screen; fit once they have.
  await until(() => store.graph.getChildren(store.state.currentPageId).length > 0).toBe(true)
  await new Promise((resolve) => requestAnimationFrame(resolve))
  store.zoomToFit()
}

const { store, build, focus } = useStageDocument(role === 'host' ? hostScene : guestScene)
const { engage, disengage, guardWheel } = useWheelEngagement()
const touch = useMediaQuery('(pointer: coarse)')

onMounted(() => void build())
onScopeDispose(() => session.value?.dispose())

const stopSelection = store.onEditorEvent('selection:changed', (ids) =>
  session.value?.updateSelection(ids)
)
onScopeDispose(stopSelection)

function publishCursor(x: number, y: number) {
  session.value?.updateCursor(x, y, store.state.currentPageId)
}

// The host's agent plays the recorded turn; the guest sees it work through the room.
const agent = role === 'host' ? useRecordedChat(store, () => messages.value.stage.ai) : null

/** The view follows the agent while it works, so it comes back to the whole card after. */
async function askAgent() {
  if (!agent) return
  await agent.play()
  store.zoomToFit()
}

function onPointerDown() {
  engage()
  focus()
}
</script>

<template>
  <section class="relative flex min-h-0 min-w-0 flex-1 flex-col" :aria-label="label">
    <header
      class="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-panel px-3 text-[11px] font-semibold text-surface"
    >
      <span class="size-2 rounded-full" :style="{ background: colorToCSS(identity.color) }" />
      {{ label }}
      <AppButton
        v-if="agent"
        class="ml-auto"
        variant="outline"
        size="xs"
        shape="pill"
        :disabled="agent.running.value"
        @click="askAgent"
      >
        <template #leading><IconSparkles /></template>
        {{ messages.stage.collab.askAgent }}
      </AppButton>
    </header>
    <div
      class="relative flex min-h-0 flex-1"
      :class="touch && '*:pointer-events-none'"
      @pointerdown.capture="onPointerDown"
      @focusin.capture="focus"
      @pointerleave="disengage"
      @wheel.capture="guardWheel"
    >
      <StageCanvas @cursor="publishCursor" />
    </div>
  </section>
</template>
