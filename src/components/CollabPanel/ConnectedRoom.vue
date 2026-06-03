<script setup lang="ts">
import { selectTarget } from '@inkly/vue'
import AppInput from '@/components/ui/AppInput.vue'
import { useCollabPanelContext } from '@/components/CollabPanel/context'

const collab = useCollabPanelContext()
</script>

<template>
  <div class="mb-3 text-xs font-medium text-surface">{{ collab.dialogs.roomLink }}</div>
  <div class="mb-3 flex items-center gap-1.5">
    <AppInput
      :model-value="collab.shareUrl"
      readonly
      test-id="collab-room-link"
      :ui="{ base: 'min-w-0 flex-1' }"
      @focus="selectTarget($event)"
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
