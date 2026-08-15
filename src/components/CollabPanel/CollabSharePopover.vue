<script setup lang="ts">
import { computed, ref } from 'vue'
import { tv } from 'tailwind-variants'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import { isCloudDocument } from '@/app/collab/cloud-sharing'
import { useEditorStore } from '@/app/editor/active-store'
import CloudShareDialog from '@/components/CollabPanel/CloudShareDialog.vue'
import ConnectedRoom from '@/components/CollabPanel/ConnectedRoom.vue'
import JoinRoomPrompt from '@/components/CollabPanel/JoinRoomPrompt.vue'
import ShareOrJoinRoom from '@/components/CollabPanel/ShareOrJoinRoom.vue'
import { useCollabPanelContext } from '@/components/CollabPanel/context'
import { usePopoverUI } from '@/components/ui/popover'
import collaborationTheme from '@/theme/collaboration'

const collab = useCollabPanelContext()
const store = useEditorStore()
const cloudDialogOpen = ref(false)
const cloudDocument = computed(() => isCloudDocument(store))
const cls = usePopoverUI({ content: 'z-50 w-72 p-3' })
const connection = computed(() => {
  if (collab.state.connected) return 'connected'
  if (collab.isJoining) return 'joining'
  return 'idle'
})
const collaboration = tv(collaborationTheme)
const styles = computed(() => collaboration({ connection: connection.value }))
</script>

<template>
  <button
    v-if="cloudDocument"
    data-test-id="cloud-share-button"
    :class="styles.shareButton()"
    @click="cloudDialogOpen = true"
  >
    <icon-lucide-share-2 class="size-3.5" />
    {{ collab.dialogs.share }}
  </button>
  <PopoverRoot v-else v-model:open="collab.popoverOpen">
    <PopoverTrigger as-child>
      <button
        data-test-id="collab-share-button"
        :data-connection="connection"
        :class="styles.shareButton()"
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
  <CloudShareDialog v-if="cloudDocument" v-model:open="cloudDialogOpen" />
</template>
