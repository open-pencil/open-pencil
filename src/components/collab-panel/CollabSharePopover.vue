<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'

import ConnectedRoom from '@/components/collab-panel/ConnectedRoom.vue'
import { useCollabPanelContext } from '@/components/collab-panel/context'
import ShareOrJoinRoom from '@/components/collab-panel/ShareOrJoinRoom.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import { shareButton } from '@/theme/collaboration/share-button'

const collab = useCollabPanelContext()
const cls = usePopoverUI({ content: 'z-50 w-72 p-3' })
const connection = computed(() => {
  const status = collab.state.status
  if (status === 'joining' || status === 'waiting') return 'joining'
  return status ? 'connected' : 'idle'
})
</script>

<template>
  <PopoverRoot v-model:open="collab.popoverOpen">
    <PopoverTrigger as-child>
      <button
        data-test-id="collab-share-button"
        :data-connection="connection"
        :class="shareButton({ connection })"
      >
        <icon-lucide-share-2 class="size-3.5" />
        {{ collab.messages.share }}
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
        <ConnectedRoom v-if="collab.state.inRoom" />
        <ShareOrJoinRoom v-else />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
