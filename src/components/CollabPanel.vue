<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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

import { colorToCSS } from '@open-pencil/core'
import { useCollabInjected } from '@/composables/use-collab'
import { toast } from '@/composables/use-toast'
import { initials } from '@/utils/text'
import { useVoiceInjected } from '@/composables/use-voice'

const route = useRoute()
const router = useRouter()
const collab = useCollabInjected()

const voice = useVoiceInjected()

const joinInput = ref('')
const nameDraft = ref(collab.state.value.localName)
const copied = ref(false)
const pendingRoomId = (route.params.roomId as string) || null
const popoverOpen = ref(!!pendingRoomId)

const state = computed(() => collab.state.value)
const peers = computed(() => collab.remotePeers.value)
const followingPeer = computed(() => collab.followingPeer.value)

const shareUrl = computed(() => {
  if (!state.value.roomId) return ''
  return `${window.location.origin}/share/${state.value.roomId}`
})

const isJoining = computed(() => !!pendingRoomId && !state.value.connected)

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
  collab.setLocalName(nameDraft.value.trim())
  const roomId = collab.shareCurrentDoc()
  router.push(`/share/${roomId}`)
  navigator.clipboard.writeText(`${window.location.origin}/share/${roomId}`)
  toast.show('Link copied to clipboard')
  popoverOpen.value = false
}

function onJoin() {
  const roomId = pendingRoomId || joinInput.value.trim().replace(/.*\/share\//, '')
  if (!roomId || !nameDraft.value.trim()) return
  collab.setLocalName(nameDraft.value.trim())
  collab.connect(roomId)
  router.push(`/share/${roomId}`)
  popoverOpen.value = false
}

function onDisconnect() {
  collab.disconnect()
  router.push('/')
}

function onVoiceToggle() {
  if (!voice) return
  if (voice.voiceState.value.inCall) {
    voice.leaveCall()
  } else {
    voice.joinCall()
  }
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
                data-test-id="collab-local-avatar"
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
                data-test-id="collab-peer-avatar"
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
                @click="collab.followPeer(followingPeer === peer.clientId ? null : peer.clientId)"
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
          data-test-id="collab-share-button"
          class="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border-none px-3 text-xs font-medium transition-colors"
          :class="
            state.connected
              ? 'bg-green-600 text-white hover:bg-green-700'
              : isJoining
                ? 'animate-pulse bg-amber-600 text-white'
                : 'bg-accent text-white hover:bg-accent/90'
          "
        >
          <icon-lucide-share-2 class="size-3.5" />
          {{ state.connected ? 'Connected' : isJoining ? 'Join room' : 'Share' }}
        </button>
      </PopoverTrigger>

      <PopoverPortal>
        <PopoverContent
          data-test-id="collab-popover"
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
                data-test-id="collab-room-link"
                class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                @focus="($event.target as HTMLInputElement).select()"
              />
              <button
                data-test-id="collab-copy-link"
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
              data-test-id="collab-disconnect"
              class="flex h-7 w-full cursor-pointer items-center justify-center rounded border border-border bg-transparent text-xs text-muted hover:bg-hover hover:text-surface"
              @click="onDisconnect"
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
                data-test-id="collab-name-input"
                class="w-full rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                placeholder="Enter your name"
                autofocus
                @keydown.enter="onJoin"
              />
            </div>

            <button
              data-test-id="collab-join-button"
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
                data-test-id="collab-name-input"
                class="w-full rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                placeholder="Enter your name"
                @keydown.enter="onShare"
              />
            </div>

            <button
              data-test-id="collab-share-file"
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
                data-test-id="collab-join-input"
                class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                placeholder="Paste room link or ID"
                @keydown.enter="onJoin"
              />
              <button
                data-test-id="collab-join-room-button"
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
