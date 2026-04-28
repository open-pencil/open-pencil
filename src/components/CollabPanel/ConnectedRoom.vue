<script setup lang="ts">
import { useCollabPanelContext } from '@/components/CollabPanel/context'

const collab = useCollabPanelContext()
</script>

<template>
  <div class="mb-3 text-xs font-medium text-surface">{{ collab.dialogs.roomLink }}</div>
  <div class="mb-3 flex items-center gap-1.5">
    <input
      :value="collab.shareUrl"
      readonly
      data-test-id="collab-room-link"
      class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-surface"
      @focus="($event.target as HTMLInputElement).select()"
    />
    <button
      data-test-id="collab-copy-link"
      class="flex h-7 cursor-pointer items-center gap-1 rounded border-none bg-accent px-2 text-xs text-white hover:bg-accent/90"
      @click="collab.copyLink"
    >
      <icon-lucide-check v-if="collab.copied" class="size-3" />
      <icon-lucide-copy v-else class="size-3" />
      {{ collab.copied ? 'Copied' : 'Copy' }}
    </button>
  </div>

  <div class="mb-2 text-xs font-medium text-surface">
    {{ collab.peers.length + 1 }} {{ collab.peers.length === 0 ? 'person' : 'people' }} in this room
  </div>

  <button
    data-test-id="collab-disconnect"
    class="flex h-7 w-full cursor-pointer items-center justify-center rounded border border-border bg-transparent text-xs text-muted hover:bg-hover hover:text-surface"
    @click="collab.disconnect"
  >
    Disconnect
  </button>
</template>
