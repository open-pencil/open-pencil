<script setup lang="ts">
import { computed } from 'vue'

import { selectTarget } from '@open-pencil/vue'

import { useCollabPanelContext } from '@/components/collab-panel/context'
import { roomStatusText } from '@/components/collab-room/statusText'
import { useRoomActions } from '@/components/collab-room/useRoomActions'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { roomStatus } from '@/theme/collaboration/room-status'

const collab = useCollabPanelContext()
const room = useRoomActions()
const ui = roomStatus()

const statusText = computed(() =>
  roomStatusText(collab.messages, collab.state.status ?? 'joining', collab.state.peers.length)
)
</script>

<template>
  <p :class="ui.root()" :data-status="collab.state.status" data-test-id="collab-room-status">
    <span :class="ui.dot()" aria-hidden="true" />
    {{ statusText }}
  </p>

  <div class="mb-1.5 text-xs font-medium text-surface">{{ collab.messages.roomLink }}</div>
  <div class="mb-3 flex items-center gap-1.5">
    <AppInput
      :model-value="collab.shareURL"
      readonly
      :aria-label="collab.messages.roomLink"
      data-test-id="collab-room-link"
      class="min-w-0 flex-1"
      @focus="selectTarget($event)"
    />
    <AppButton
      color="primary"
      variant="solid"
      data-test-id="collab-copy-link"
      @click="collab.copyLink"
    >
      <template #leading>
        <icon-lucide-check v-if="collab.copied" class="size-3" />
        <icon-lucide-copy v-else class="size-3" />
      </template>
      {{ collab.copied ? collab.messages.linkCopied : collab.messages.copyLink }}
    </AppButton>
  </div>

  <label for="collab-room-name-input" class="mb-1 block text-xs text-muted">
    {{ collab.messages.yourName }}
  </label>
  <AppInput
    id="collab-room-name-input"
    v-model="collab.nameDraft"
    data-test-id="collab-name-input"
    :placeholder="collab.state.localName"
    @enter="collab.saveName"
    @change="collab.saveName"
  />
  <p v-if="room.nameHint.value" class="mt-1 text-[11px] text-muted" data-test-id="collab-name-hint">
    {{ room.nameHint.value }}
  </p>

  <div class="mt-3 flex items-center justify-between gap-2">
    <div v-if="room.desktopLink.value" class="flex min-w-0 flex-col gap-0.5">
      <a
        :href="room.desktopLink.value"
        class="text-xs text-accent underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
        data-test-id="collab-open-desktop"
      >
        {{ collab.messages.openInDesktopApp }}
      </a>
      <a
        v-if="room.downloadURL.value"
        :href="room.downloadURL.value"
        target="_blank"
        rel="noopener noreferrer"
        class="text-[11px] text-muted underline-offset-2 hover:text-surface hover:underline focus-visible:underline focus-visible:outline-none"
        data-test-id="collab-download-desktop"
      >
        {{ collab.messages.downloadDesktopApp }}
      </a>
    </div>
    <span v-else />
    <AppButton variant="outline" data-test-id="collab-leave" @click="collab.disconnect">
      {{ collab.messages.leaveRoom }}
    </AppButton>
  </div>
</template>
