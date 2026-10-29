<script setup lang="ts">
import { useCollabPanelContext } from '@/components/collab-panel/context'

import PresenceAvatars from './PresenceAvatars.vue'

const collab = useCollabPanelContext()
</script>

<template>
  <PresenceAvatars
    :rows="collab.presenceRows"
    :following="collab.following"
    :connected="collab.state.status === 'live'"
    :can-leave="collab.state.canLeave"
    @follow="collab.follow"
    @rename="collab.renameLocalAgent"
    @leave="collab.disconnect"
  />
</template>
