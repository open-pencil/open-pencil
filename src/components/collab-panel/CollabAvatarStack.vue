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
    :in-room="collab.state.inRoom"
    @follow="collab.follow"
    @rename="collab.renameLocalAgent"
    @leave="collab.disconnect"
  />
</template>
