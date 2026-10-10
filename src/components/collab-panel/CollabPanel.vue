<script setup lang="ts">
import { computed } from 'vue'

import { isCloudBinding } from '@/app/cloud/documents/status'
import { useEditorStore } from '@/app/editor/active-store'
import CloudShareButton from '@/components/cloud/share/CloudShareButton.vue'
import CollabAvatarStack from '@/components/collab-panel/CollabAvatarStack.vue'
import CollabSharePopover from '@/components/collab-panel/CollabSharePopover.vue'
import { provideCollabPanel } from '@/components/collab-panel/context'
import VoiceCallControl from '@/components/voice-call/VoiceCallControl.vue'

const collab = provideCollabPanel()
const store = useEditorStore()
// Cloud documents share through their server; everything else through a peer-to-peer room.
const cloud = computed(() => isCloudBinding(store.getStorageBinding()))
</script>

<template>
  <div class="flex w-full items-center justify-end gap-1.5">
    <CollabAvatarStack />
    <VoiceCallControl v-if="collab.state.inRoom" :people="collab.callRows" />
    <div class="flex-1" />
    <CloudShareButton v-if="cloud" />
    <CollabSharePopover v-else />
  </div>
</template>
