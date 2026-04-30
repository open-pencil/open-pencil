<script setup lang="ts">
import { useCollabPanelContext } from '@/components/CollabPanel/context'

const collab = useCollabPanelContext()
</script>

<template>
  <div class="mb-3">
    <label class="mb-1 block text-xs text-muted">{{ collab.dialogs.yourName }}</label>
    <input
      v-model="collab.nameDraft"
      data-test-id="collab-name-input"
      class="w-full rounded border border-border bg-input px-2 py-1 text-xs text-surface"
      :placeholder="collab.dialogs.enterYourName"
      @keydown.enter="collab.share"
    />
  </div>

  <button
    data-test-id="collab-share-file"
    class="mb-3 flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded border-none bg-accent text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
    :disabled="!collab.nameDraft.trim()"
    @click="collab.share"
  >
    <icon-lucide-share-2 class="size-3.5" />
    {{ collab.dialogs.shareThisFile }}
  </button>

  <div class="mb-2 flex items-center gap-2">
    <div class="h-px flex-1 bg-border" />
    <span class="text-[11px] text-muted">{{ collab.dialogs.orJoinRoom }}</span>
    <div class="h-px flex-1 bg-border" />
  </div>

  <div class="flex items-center gap-1.5">
    <input
      v-model="collab.joinInput"
      data-test-id="collab-join-input"
      class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-surface"
      :placeholder="collab.dialogs.pasteRoomLinkOrId"
      @keydown.enter="collab.join"
    />
    <button
      data-test-id="collab-join-room-button"
      class="flex h-7 cursor-pointer items-center rounded border-none bg-accent px-3 text-xs text-white hover:bg-accent/90 disabled:opacity-50"
      :disabled="!collab.joinInput.trim() || !collab.nameDraft.trim()"
      @click="collab.join"
    >
      Join
    </button>
  </div>
</template>
