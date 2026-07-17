<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import { initials } from '@/app/shell/ui'
import { colorToCSS } from '@open-pencil/core/color'
import { useMobileHudContext } from '@/components/MobileHud/context'
import collaborationTheme from '@/theme/collaboration'

const hud = useMobileHudContext()
const collaboration = tv(collaborationTheme)
const styles = collaboration({ size: 'md' })

function peerAvatarClass(following: boolean) {
  return collaboration({ size: 'md', following }).avatar()
}
</script>

<template>
  <PopoverRoot v-if="hud.collabState.connected">
    <PopoverTrigger as-child>
      <button :class="styles.presenceTrigger()">
        <span :class="styles.presenceDot()" />
        <span class="text-xs text-surface">Online: {{ hud.onlineCount }}</span>
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :modal="false"
        :side-offset="8"
        side="bottom"
        align="center"
        :class="styles.presenceContent()"
      >
        <div class="mb-2 text-[11px] tracking-wider text-muted uppercase">In this room</div>
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <div
              :class="styles.avatar()"
              :style="{ background: colorToCSS(hud.collabState.localColor) }"
            >
              {{ initials(hud.collabState.localName || 'You') }}
            </div>
            <span class="min-w-0 flex-1 truncate text-xs text-surface">
              {{ hud.collabState.localName || 'You' }}
            </span>
            <span class="text-[10px] text-muted">you</span>
          </div>

          <div
            v-for="peer in hud.collabPeers"
            :key="peer.clientId"
            :data-following="hud.followingPeer === peer.clientId || undefined"
            :class="styles.peerRow()"
            @click="hud.toggleFollowPeer(peer.clientId)"
          >
            <div
              :class="[peerAvatarClass(hud.followingPeer === peer.clientId), styles.peerAvatar()]"
              :style="{ background: colorToCSS(peer.color) }"
            >
              {{ initials(peer.name) }}
            </div>
            <span class="min-w-0 flex-1 truncate text-xs text-surface">{{ peer.name }}</span>
            <span v-if="hud.followingPeer === peer.clientId" class="text-[10px] text-accent">
              following
            </span>
          </div>
        </div>

        <button :class="styles.disconnect()" @click="hud.disconnect">Disconnect</button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
