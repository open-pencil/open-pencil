<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'

import { colorToCSS } from '@open-pencil/core'
import Tip from '@/components/ui/Tip.vue'
import { usePopoverUI } from '@/components/ui/popover'
import { DEFAULT_COLLAB_STATE, useCollabInjected } from '@/composables/use-collab'
import { toast } from '@/utils/toast'
import { initials } from '@/utils/text'
import { useI18n } from '@open-pencil/vue'

const route = useRoute()
const router = useRouter()
const cls = usePopoverUI({ content: 'z-50 w-72 p-3' })
const collab = useCollabInjected()
const { copy, copied } = useClipboard({ copiedDuring: 2000 })
const { dialogs } = useI18n()

const joinInput = ref('')
const nameDraft = ref(collab?.state.value.localName ?? '')
const pendingRoomId = computed(() =>
  typeof route.params.roomId === 'string' ? route.params.roomId : null
)
const popoverOpen = ref(!!pendingRoomId.value)

const state = computed(() => collab?.state.value ?? DEFAULT_COLLAB_STATE)
const peers = computed(() => collab?.remotePeers.value ?? [])
const followingPeer = computed(() => collab?.followingPeer.value ?? null)

const shareUrl = computed(() => {
  if (!state.value.roomId) return ''
  return `${window.location.origin}/share/${state.value.roomId}`
})

const isJoining = computed(() => !!pendingRoomId.value && !state.value.connected)

watch(
  pendingRoomId,
  (roomId) => {
    if (!state.value.connected) {
      popoverOpen.value = !!roomId
    }
  },
  { immediate: true }
)

function copyLink() {
  if (!shareUrl.value) return
  copy(shareUrl.value)
  toast.show('Link copied to clipboard')
}

function onShare() {
  if (!collab || !nameDraft.value.trim()) return
  collab.setLocalName(nameDraft.value.trim())
  const roomId = collab.shareCurrentDoc()
  router.push(`/share/${roomId}`)
  copy(`${window.location.origin}/share/${roomId}`)
  toast.show('Link copied to clipboard')
  popoverOpen.value = false
}

function onJoin() {
  if (!collab) return
  const roomId = pendingRoomId.value || joinInput.value.trim().replace(/.*\/share\//, '')
  if (!roomId || !nameDraft.value.trim()) return
  collab.setLocalName(nameDraft.value.trim())
  collab.connect(roomId)
  router.push(`/share/${roomId}`)
  popoverOpen.value = false
}

function onDisconnect() {
  if (!collab) return
  collab.disconnect()
  popoverOpen.value = false
  router.push('/')
}
</script>

<template>
  <div class="flex w-full items-center justify-end gap-2">
    <!-- Avatar stack -->
    <div class="flex -space-x-1.5">
      <Tip :label="`${state.localName || 'You'} (you)`">
        <div
          data-test-id="collab-local-avatar"
          class="flex size-6 items-center justify-center rounded-full border-2 border-panel text-[10px] font-semibold text-white"
          :style="{ background: colorToCSS(state.localColor) }"
        >
          {{ initials(state.localName || 'You') }}
        </div>
      </Tip>

      <Tip
        v-for="peer in peers"
        :key="peer.clientId"
        :label="
          followingPeer === peer.clientId
            ? `Following ${peer.name} (click to stop)`
            : `Click to follow ${peer.name}`
        "
      >
        <div
          data-test-id="collab-peer-avatar"
          class="flex size-6 cursor-pointer items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white transition-all"
          :class="
            followingPeer === peer.clientId ? 'border-white ring-2 ring-white/40' : 'border-panel'
          "
          :style="{ background: colorToCSS(peer.color) }"
          @click="collab?.followPeer(followingPeer === peer.clientId ? null : peer.clientId)"
        >
          {{ initials(peer.name) }}
        </div>
      </Tip>
    </div>

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
                ? 'animate-pulse bg-amber-600 text-white'
                : 'bg-accent text-white hover:bg-accent/90'
          "
        >
          <icon-lucide-share-2 class="size-3.5" />
          {{ state.connected ? dialogs.connected : isJoining ? dialogs.joinRoom : dialogs.share }}
        </button>
      </PopoverTrigger>

      <PopoverPortal>
        <PopoverContent
          data-test-id="collab-popover"
          :class="cls.content"
          :side-offset="8"
          side="bottom"
          align="end"
        >
          <!-- Connected state -->
          <template v-if="state.connected">
            <div class="mb-3 text-xs font-medium text-surface">{{ dialogs.roomLink }}</div>
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
            <div class="mb-1 text-xs font-medium text-surface">{{ dialogs.joinCollaboration }}</div>
            <div class="mb-3 text-[11px] text-muted">
              Someone shared this file with you. Enter your name to join.
            </div>

            <div class="mb-3">
              <label class="mb-1 block text-xs text-muted">{{ dialogs.yourName }}</label>
              <input
                v-model="nameDraft"
                data-test-id="collab-name-input"
                class="w-full rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                :placeholder="dialogs.enterYourName"
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
              <label class="mb-1 block text-xs text-muted">{{ dialogs.yourName }}</label>
              <input
                v-model="nameDraft"
                data-test-id="collab-name-input"
                class="w-full rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                :placeholder="dialogs.enterYourName"
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
              {{ dialogs.shareThisFile }}
            </button>

            <div class="mb-2 flex items-center gap-2">
              <div class="h-px flex-1 bg-border" />
              <span class="text-[11px] text-muted">{{ dialogs.orJoinRoom }}</span>
              <div class="h-px flex-1 bg-border" />
            </div>

            <div class="flex items-center gap-1.5">
              <input
                v-model="joinInput"
                data-test-id="collab-join-input"
                class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                :placeholder="dialogs.pasteRoomLinkOrId"
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
