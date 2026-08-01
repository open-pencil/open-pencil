<script setup lang="ts">
import CollabAvatarStack from '@/components/CollabPanel/CollabAvatarStack.vue'
import CollabSharePopover from '@/components/CollabPanel/CollabSharePopover.vue'
import { provideCollabPanel } from '@/components/CollabPanel/context'
import PresentButton from '@/components/presentation/PresentButton.vue'

provideCollabPanel()
</script>

<template>
  <div class="flex w-full items-center justify-end gap-2">
    <CollabAvatarStack />
    <div class="flex-1" />
    <PresentButton />
    <CollabSharePopover />
  </div>
</template>
