<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import ConnectedRoom from '@/components/CollabPanel/ConnectedRoom.vue'
import JoinRoomPrompt from '@/components/CollabPanel/JoinRoomPrompt.vue'
import ShareOrJoinRoom from '@/components/CollabPanel/ShareOrJoinRoom.vue'
import { useCollabPanelContext } from '@/components/CollabPanel/context'
import { usePopoverUI } from '@/components/ui/popover'

const collab = useCollabPanelContext()
const cls = usePopoverUI({ content: 'z-50 w-72 p-3' })
</script>

<template>
  <PopoverRoot v-model:open="collab.popoverOpen">
    <PopoverTrigger as-child>
      <button
        data-test-id="collab-share-button"
        class="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border-none px-3 text-xs font-medium transition-colors"
        :class="
          collab.state.connected
            ? 'bg-green-600 text-white hover:bg-green-700'
            : collab.isJoining
              ? 'animate-pulse bg-amber-600 text-white'
              : 'bg-accent text-white hover:bg-accent/90'
        "
      >
        <icon-lucide-share-2 class="size-3.5" />
        {{
          collab.state.connected
            ? collab.dialogs.connected
            : collab.isJoining
              ? collab.dialogs.joinRoom
              : collab.dialogs.share
        }}
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
