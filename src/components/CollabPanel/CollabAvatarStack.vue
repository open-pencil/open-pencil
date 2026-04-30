<script setup lang="ts">
import { colorToCSS } from '@open-pencil/core/color'

import Tip from '@/components/ui/Tip.vue'
import { initials } from '@/app/shell/ui'
import { useCollabPanelContext } from '@/components/CollabPanel/context'

const collab = useCollabPanelContext()
</script>

<template>
  <div class="flex -space-x-1.5">
    <Tip :label="`${collab.state.localName || 'You'} (you)`">
      <div
        data-test-id="collab-local-avatar"
        class="flex size-6 items-center justify-center rounded-full border-2 border-panel text-[10px] font-semibold text-white"
        :style="{ background: colorToCSS(collab.state.localColor) }"
      >
        {{ initials(collab.state.localName || 'You') }}
      </div>
    </Tip>

    <Tip
      v-for="peer in collab.peers"
      :key="peer.clientId"
      :label="
        collab.followingPeer === peer.clientId
          ? `Following ${peer.name} (click to stop)`
          : `Click to follow ${peer.name}`
      "
    >
      <div
        data-test-id="collab-peer-avatar"
        class="flex size-6 cursor-pointer items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white transition-all"
        :class="
          collab.followingPeer === peer.clientId
            ? 'border-white ring-2 ring-white/40'
            : 'border-panel'
        "
        :style="{ background: colorToCSS(peer.color) }"
        @click="collab.toggleFollowPeer(peer.clientId)"
      >
        {{ initials(peer.name) }}
      </div>
    </Tip>
  </div>
</template>
