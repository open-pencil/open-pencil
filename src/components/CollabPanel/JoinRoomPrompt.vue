<script setup lang="ts">
import { useCollabPanelContext } from '@/components/CollabPanel/context'

const collab = useCollabPanelContext()
</script>

<template>
  <div class="mb-1 text-xs font-medium text-surface">{{ collab.dialogs.joinCollaboration }}</div>
  <div class="mb-3 text-[11px] text-muted">
    Someone shared this file with you. Enter your name to join.
  </div>

  <div class="mb-3">
    <label class="mb-1 block text-xs text-muted">{{ collab.dialogs.yourName }}</label>
    <input
      v-model="collab.nameDraft"
      data-test-id="collab-name-input"
      class="w-full rounded border border-border bg-input px-2 py-1 text-xs text-surface"
      :placeholder="collab.dialogs.enterYourName"
      autofocus
      @keydown.enter="collab.join"
    />
  </div>

  <button
    data-test-id="collab-join-button"
    class="flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded border-none bg-accent text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
    :disabled="!collab.nameDraft.trim()"
    @click="collab.join"
  >
    <icon-lucide-users class="size-3.5" />
    Join room
  </button>
</template>
