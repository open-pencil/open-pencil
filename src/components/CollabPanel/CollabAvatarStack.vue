<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { colorToCSS } from '@open-pencil/core/color'

import Tip from '@/components/ui/Tip.vue'
import { initials } from '@/app/shell/ui'
import { useCollabPanelContext } from '@/components/CollabPanel/context'
import collaborationTheme from '@/theme/collaboration'
import { useI18n } from '@open-pencil/vue'

const collab = useCollabPanelContext()
const { dialogs } = useI18n()
const collaboration = tv(collaborationTheme)
const avatar = collaboration({ size: 'sm', bordered: true })

function peerAvatarClass(following: boolean) {
  return collaboration({ size: 'sm', bordered: true, following }).avatar()
}
</script>

<template>
  <div class="flex -space-x-1.5">
    <Tip :label="`${collab.state.localName || dialogs.you} (${dialogs.youSuffix})`">
      <div
        data-test-id="collab-local-avatar"
        :class="avatar.avatar()"
        :style="{ background: colorToCSS(collab.state.localColor) }"
      >
        {{ initials(collab.state.localName || dialogs.you) }}
      </div>
    </Tip>

    <Tip
      v-for="peer in collab.peers"
      :key="peer.clientId"
      :label="
        collab.followingPeer === peer.clientId
          ? dialogs.followingPeerStop({ name: peer.name })
          : dialogs.clickToFollowPeer({ name: peer.name })
      "
    >
      <div
        data-test-id="collab-peer-avatar"
        :data-following="collab.followingPeer === peer.clientId || undefined"
        :class="[peerAvatarClass(collab.followingPeer === peer.clientId), avatar.peerAvatar()]"
        :style="{ background: colorToCSS(peer.color) }"
        @click="collab.toggleFollowPeer(peer.clientId)"
      >
        {{ initials(peer.name) }}
      </div>
    </Tip>
  </div>
</template>
