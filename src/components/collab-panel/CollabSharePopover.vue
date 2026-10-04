<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'

import ConnectedRoom from '@/components/collab-panel/ConnectedRoom.vue'
import { useCollabPanelContext } from '@/components/collab-panel/context'
import JoinRoomPrompt from '@/components/collab-panel/JoinRoomPrompt.vue'
import ShareOrJoinRoom from '@/components/collab-panel/ShareOrJoinRoom.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import { shareButton } from '@/theme/collaboration/share-button'

const collab = useCollabPanelContext()
const cls = usePopoverUI({ content: 'z-50 w-72 p-3' })
const connection = computed(() => {
  if (collab.state.connected) return 'connected'
  if (collab.isJoining) return 'joining'
  return 'idle'
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
        {{ collab.isJoining ? collab.messages.joinRoom : collab.messages.share }}
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
        <ConnectedRoom v-if="collab.state.connected" />
        <JoinRoomPrompt v-else-if="collab.isJoining" />
        <ShareOrJoinRoom v-else />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
