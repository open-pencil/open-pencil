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

import { colorToCSS } from '@open-pencil/core'
import type { CollabState, RemotePeer } from '@/composables/use-collab'
import { toast } from '@/composables/use-toast'
import { initials } from '@/utils/text'

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


</script>

<template>
  <div class="flex w-full items-center justify-end gap-2">
    <!-- Avatar stack -->
    <TooltipProvider :delay-duration="200">
      <div class="flex -space-x-1.5">
        <TooltipRoot>
          <TooltipTrigger as-child>
            <div
              data-test-id="collab-local-avatar"
              class="flex size-6 items-center justify-center rounded-full border-2 border-panel text-[10px] font-semibold text-white"
              :style="{ background: colorToCSS(state.localColor) }"
            >
              {{ initials(state.localName || 'You') }}
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

        <TooltipRoot v-for="peer in peers" :key="peer.clientId">
          <TooltipTrigger as-child>
            <div
              data-test-id="collab-peer-avatar"
              class="flex size-6 cursor-pointer items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white transition-all"
              :class="
                followingPeer === peer.clientId
                  ? 'border-white ring-2 ring-white/40'
                  : 'border-panel'
              "
              :style="{ background: colorToCSS(peer.color) }"
              @click="emit('follow', followingPeer === peer.clientId ? null : peer.clientId)"
            >
              {{ initials(peer.name) }}
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
