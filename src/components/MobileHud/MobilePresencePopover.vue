<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'

import { colorToCSS } from '@open-pencil/core/color'

import { initials } from '@/app/shell/ui'
import HudButton from '@/components/mobile-hud/HudButton.vue'
import { useMobileHudContext } from '@/components/MobileHud/context'
import AppButton from '@/components/ui/button/AppButton.vue'
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
      <HudButton :label="`Online: ${hud.onlineCount}`">
        <template #leading><span :class="styles.presenceDot()" /></template>
      </HudButton>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :modal="false"
        :side-offset="8"
        side="bottom"
        align="center"
        :class="styles.presenceContent()"
      >
        <div class="mb-2 text-[11px] tracking-wider text-muted uppercase">
          {{ hud.messages.inThisRoom }}
        </div>
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
            <span class="text-[10px] text-muted">{{ hud.common.youSuffix }}</span>
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

        <AppButton variant="outline" class="mt-3 w-full" @click="hud.disconnect">
          {{ hud.messages.disconnect }}
        </AppButton>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
