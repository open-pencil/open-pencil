<script setup lang="ts">
import { useLandingMessages } from '#docs/theme/landing/content/messages'
import { useIntersectionObserver } from '@vueuse/core'
import { MotionConfig } from 'motion-v'
import { TooltipProvider } from 'reka-ui'
import { computed, ref } from 'vue'

import type { Color } from '@open-pencil/scene-graph'

import { PEER_COLORS } from '@/constants'

import { prepareEngine } from '../engine-assets'
import CollabPane from './CollabPane.vue'
import { createLocalRoom } from './local-room'

/** Stages mount a screen ahead of the viewport, so a block is live before it scrolls in. */
const MOUNT_MARGIN = '100% 0px'
const ROOM_ID = 'landing'
/** The other person in the room. A name, so it is not translated. */
const TEAMMATE = 'Sam'

const messages = useLandingMessages()
const joinRoom = createLocalRoom()

// Both screens are the visitor's to use; each shows the other as a named person.
/** The app's peer palette: blue for the visitor, purple for the teammate. */
const peerColor = (index: number): Color => PEER_COLORS[index] ?? { r: 0, g: 0, b: 0, a: 1 }
const you = { name: computed(() => messages.value.stage.collab.you), color: peerColor(1) }
const teammate = { name: computed(() => TEAMMATE), color: peerColor(4) }

/** `start`: it begins loading as it nears the viewport. `ready`: both screens show the document. */
const emit = defineEmits<{ start: []; ready: [] }>()
const panesReady = ref(0)
function paneReady(): void {
  panesReady.value += 1
  if (panesReady.value === 2) emit('ready')
}

const root = ref<HTMLElement | null>(null)
const mounted = ref(false)
const { stop } = useIntersectionObserver(
  root,
  async ([entry]) => {
    if (!entry?.isIntersecting) return
    stop()
    emit('start')
    await prepareEngine()
    mounted.value = true
  },
  { rootMargin: MOUNT_MARGIN }
)
</script>

<template>
  <MotionConfig reduced-motion="user">
    <TooltipProvider :delay-duration="400">
      <!-- Typography and selection behaviour the app sets on `body` in `src/app.css`. -->
      <div
        ref="root"
        class="op-app relative flex h-full overflow-hidden bg-canvas text-[13px] leading-normal text-surface select-none max-md:flex-col"
      >
        <template v-if="mounted">
          <CollabPane
            role="host"
            :join-room="joinRoom"
            :room-id="ROOM_ID"
            :identity="you"
            :label="messages.stage.collab.yourScreen"
            @ready="paneReady"
          />
          <div class="w-px shrink-0 bg-border max-md:h-px max-md:w-full" />
          <CollabPane
            role="guest"
            :join-room="joinRoom"
            :room-id="ROOM_ID"
            :identity="teammate"
            :label="messages.stage.collab.theirScreen"
            @ready="paneReady"
          />
        </template>
      </div>
    </TooltipProvider>
  </MotionConfig>
</template>
