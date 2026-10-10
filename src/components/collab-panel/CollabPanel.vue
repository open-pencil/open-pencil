<script setup lang="ts">
import CollabAvatarStack from '@/components/collab-panel/CollabAvatarStack.vue'
import CollabSharePopover from '@/components/collab-panel/CollabSharePopover.vue'
import { provideCollabPanel } from '@/components/collab-panel/context'
import VoiceCallControl from '@/components/voice-call/VoiceCallControl.vue'

const collab = provideCollabPanel()
</script>

<template>
  <div class="flex w-full items-center justify-end gap-1.5">
    <CollabAvatarStack />
    <VoiceCallControl v-if="collab.state.inRoom" :people="collab.callRows" />
    <div class="flex-1" />
    <CollabSharePopover />
  </div>
</template>
