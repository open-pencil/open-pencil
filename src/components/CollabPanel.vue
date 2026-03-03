<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
  TooltipRoot,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent,
  TooltipProvider
} from 'reka-ui'

import type { CollabState, RemotePeer } from '@/composables/use-collab'
import { toast } from '@/composables/use-toast'
import { useVoiceInjected } from '@/composables/use-voice'
import type { Color } from '@/types'

const props = defineProps<{
  state: CollabState
  peers: RemotePeer[]
  pendingRoomId?: string | null
  followingPeer?: number | null
}>()

const emit = defineEmits<{
  share: []
  join: [roomId: string]
  disconnect: []
  'update:name': [name: string]
  follow: [clientId: number | null]
}>()

const voice = useVoiceInjected()

const joinInput = ref('')
const nameDraft = ref(props.state.localName)
const copied = ref(false)
const popoverOpen = ref(!!props.pendingRoomId)

const shareUrl = computed(() => {
  if (!props.state.roomId) return ''
  return `${window.location.origin}/share/${props.state.roomId}`
})

const isJoining = computed(() => !!props.pendingRoomId && !props.state.connected)

function copyLink() {
  if (!shareUrl.value) return
  navigator.clipboard.writeText(shareUrl.value)
  toast.show('Link copied to clipboard')
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function onShare() {
  if (!nameDraft.value.trim()) return
  emit('update:name', nameDraft.value.trim())
  emit('share')
  popoverOpen.value = false
}

function onJoin() {
  const roomId = props.pendingRoomId || joinInput.value.trim().replace(/.*\/share\//, '')
  if (!roomId || !nameDraft.value.trim()) return
  emit('update:name', nameDraft.value.trim())
  emit('join', roomId)
  popoverOpen.value = false
}

function onVoiceToggle() {
  if (!voice) return
  if (voice.voiceState.value.inCall) {
    voice.leaveCall()
  } else {
    voice.joinCall()
  }
}

function colorToCSS(c: Color): string {
  return `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`
}

function initials(name: string): string {
  return (
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  )
}
</script>

<template>
  <div class="flex w-full items-center justify-end gap-2">
    <!-- Avatar stack -->
    <TooltipProvider :delay-duration="200">
      <div class="flex -space-x-1.5">
        <!-- Local user avatar -->
        <TooltipRoot>
          <TooltipTrigger as-child>
            <div class="relative">
              <div
                class="flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white transition-shadow"
                :class="[
                  voice?.voiceState.value.speaking
                    ? 'border-panel ring-2 animate-pulse'
                    : 'border-panel'
                ]"
                :style="{
                  background: colorToCSS(state.localColor),
                  ...(voice?.voiceState.value.speaking
                    ? { '--tw-ring-color': colorToCSS(state.localColor) }
                    : {})
                }"
              >
                {{ initials(state.localName || 'You') }}
              </div>
              <div
                v-if="voice?.voiceState.value.inCall && voice.voiceState.value.muted"
                class="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-red-600"
              >
                <icon-lucide-mic-off class="size-2 text-white" />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              class="rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg"
              :side-offset="4"
            >
              {{ state.localName || 'You' }} (you)
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>

        <!-- Remote peer avatars -->
        <TooltipRoot v-for="peer in peers" :key="peer.clientId">
          <TooltipTrigger as-child>
            <div class="relative">
              <div
                class="flex size-6 cursor-pointer items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white transition-all"
                :class="[
                  followingPeer === peer.clientId
                    ? 'border-white ring-2 ring-white/40'
                    : peer.voice?.speaking
                      ? 'border-panel ring-2 animate-pulse'
                      : 'border-panel'
                ]"
                :style="{
                  background: colorToCSS(peer.color),
                  ...(peer.voice?.speaking ? { '--tw-ring-color': colorToCSS(peer.color) } : {})
                }"
                @click="emit('follow', followingPeer === peer.clientId ? null : peer.clientId)"
              >
                {{ initials(peer.name) }}
              </div>
              <div
                v-if="peer.voice?.inCall && peer.voice.muted"
                class="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-red-600"
              >
                <icon-lucide-mic-off class="size-2 text-white" />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              class="rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg"
              :side-offset="4"
            >
              {{
                followingPeer === peer.clientId
                  ? `Following ${peer.name} (click to stop)`
                  : `Click to follow ${peer.name}`
              }}
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </div>
    </TooltipProvider>

    <div class="flex-1" />

    <!-- Voice call button -->
    <TooltipProvider v-if="state.connected" :delay-duration="200">
      <div class="flex items-center gap-1">
        <!-- Mute toggle (visible when in call) -->
        <TooltipRoot v-if="voice?.voiceState.value.inCall">
          <TooltipTrigger as-child>
            <button
              class="flex size-7 cursor-pointer items-center justify-center rounded-md border-none transition-colors"
              :class="
                voice.voiceState.value.muted
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              "
              @click="voice.toggleMute"
            >
              <icon-lucide-mic-off v-if="voice.voiceState.value.muted" class="size-3.5" />
              <icon-lucide-mic v-else class="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              class="rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg"
              :side-offset="4"
            >
              {{ voice.voiceState.value.muted ? 'Unmute (M)' : 'Mute (M)' }}
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>

        <!-- Join/Leave call button -->
        <TooltipRoot>
          <TooltipTrigger as-child>
            <button
              class="flex size-7 cursor-pointer items-center justify-center rounded-md border-none transition-colors"
              :class="
                voice?.voiceState.value.inCall
                  ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                  : 'bg-surface/10 text-muted hover:bg-surface/20 hover:text-surface'
              "
              @click="onVoiceToggle"
            >
              <icon-lucide-phone-off v-if="voice?.voiceState.value.inCall" class="size-3.5" />
              <icon-lucide-mic v-else class="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              class="rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow-lg"
              :side-offset="4"
            >
              {{ voice?.voiceState.value.inCall ? 'Leave voice call' : 'Join voice call' }}
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </div>
    </TooltipProvider>

    <!-- Share button / popover -->
    <PopoverRoot v-model:open="popoverOpen">
      <PopoverTrigger as-child>
        <button
          class="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border-none px-3 text-xs font-medium transition-colors"
          :class="
            state.connected
              ? 'bg-green-600 text-white hover:bg-green-700'
              : isJoining
                ? 'bg-amber-600 text-white animate-pulse'
                : 'bg-accent text-white hover:bg-accent/90'
          "
        >
          <icon-lucide-share-2 class="size-3.5" />
          {{ state.connected ? 'Connected' : isJoining ? 'Join room' : 'Share' }}
        </button>
      </PopoverTrigger>

      <PopoverPortal>
        <PopoverContent
          class="z-50 w-72 rounded-lg border border-border bg-panel p-3 shadow-xl"
          :side-offset="8"
          side="bottom"
          align="end"
        >
          <!-- Connected state -->
          <template v-if="state.connected">
            <div class="mb-3 text-xs font-medium text-surface">Room link</div>
            <div class="mb-3 flex items-center gap-1.5">
              <input
                :value="shareUrl"
                readonly
                class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                @focus="($event.target as HTMLInputElement).select()"
              />
              <button
                class="flex h-7 cursor-pointer items-center gap-1 rounded border-none bg-accent px-2 text-xs text-white hover:bg-accent/90"
                @click="copyLink"
              >
                <icon-lucide-check v-if="copied" class="size-3" />
                <icon-lucide-copy v-else class="size-3" />
                {{ copied ? 'Copied' : 'Copy' }}
              </button>
            </div>

            <div class="mb-2 text-xs font-medium text-surface">
              {{ peers.length + 1 }} {{ peers.length === 0 ? 'person' : 'people' }} in this room
            </div>

            <button
              class="flex h-7 w-full cursor-pointer items-center justify-center rounded border border-border bg-transparent text-xs text-muted hover:bg-hover hover:text-surface"
              @click="emit('disconnect')"
            >
              Disconnect
            </button>
          </template>

          <!-- Joining via /share/ link -->
          <template v-else-if="isJoining">
            <div class="mb-1 text-xs font-medium text-surface">Join collaboration</div>
            <div class="mb-3 text-[11px] text-muted">
              Someone shared this file with you. Enter your name to join.
            </div>

            <div class="mb-3">
              <label class="mb-1 block text-xs text-muted">Your name</label>
              <input
                v-model="nameDraft"
                class="w-full rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                placeholder="Enter your name"
                autofocus
                @keydown.enter="onJoin"
              />
            </div>

            <button
              class="flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded border-none bg-accent text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              :disabled="!nameDraft.trim()"
              @click="onJoin"
            >
              <icon-lucide-users class="size-3.5" />
              Join room
            </button>
          </template>

          <!-- Not connected: share or join -->
          <template v-else>
            <div class="mb-3">
              <label class="mb-1 block text-xs text-muted">Your name</label>
              <input
                v-model="nameDraft"
                class="w-full rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                placeholder="Enter your name"
                @keydown.enter="onShare"
              />
            </div>

            <button
              class="mb-3 flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded border-none bg-accent text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              :disabled="!nameDraft.trim()"
              @click="onShare"
            >
              <icon-lucide-share-2 class="size-3.5" />
              Share this file
            </button>

            <div class="mb-2 flex items-center gap-2">
              <div class="h-px flex-1 bg-border" />
              <span class="text-[11px] text-muted">or join a room</span>
              <div class="h-px flex-1 bg-border" />
            </div>

            <div class="flex items-center gap-1.5">
              <input
                v-model="joinInput"
                class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                placeholder="Paste room link or ID"
                @keydown.enter="onJoin"
              />
              <button
                class="flex h-7 cursor-pointer items-center rounded border-none bg-accent px-3 text-xs text-white hover:bg-accent/90 disabled:opacity-50"
                :disabled="!joinInput.trim() || !nameDraft.trim()"
                @click="onJoin"
              >
                Join
              </button>
            </div>
          </template>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>
