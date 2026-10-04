<script setup lang="ts">
import CollabAvatarStack from '@/components/collab-panel/CollabAvatarStack.vue'
import CollabSharePopover from '@/components/collab-panel/CollabSharePopover.vue'
import { provideCollabPanel } from '@/components/collab-panel/context'

provideCollabPanel()
</script>

<template>
  <div class="flex w-full items-center justify-end gap-2">
    <CollabAvatarStack />
    <div class="flex-1" />
    <CollabSharePopover />
  </div>
</template>
