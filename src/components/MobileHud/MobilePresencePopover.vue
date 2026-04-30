<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import { initials } from '@/app/shell/ui'
import { colorToCSS } from '@open-pencil/core/color'
import { useMobileHudContext } from '@/components/MobileHud/context'

const hud = useMobileHudContext()
</script>

<template>
  <PopoverRoot v-if="hud.collabState.connected">
    <PopoverTrigger as-child>
      <button
        class="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-panel/70 px-3 shadow-md backdrop-blur-xl select-none active:bg-hover"
      >
        <span class="size-2 rounded-full bg-green-500" />
        <span class="text-xs text-surface">Online: {{ hud.onlineCount }}</span>
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :modal="false"
        :side-offset="8"
        side="bottom"
        align="center"
        class="z-50 w-56 rounded-xl border border-border bg-panel p-3 shadow-xl"
      >
        <div class="mb-2 text-[11px] tracking-wider text-muted uppercase">In this room</div>
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <div
              class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
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
            class="flex cursor-pointer items-center gap-2 rounded-md px-0.5 py-0.5 select-none active:bg-hover"
            @click="hud.toggleFollowPeer(peer.clientId)"
          >
            <div
              class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              :class="hud.followingPeer === peer.clientId ? 'ring-2 ring-white/40' : ''"
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

        <button
          class="mt-3 flex h-7 w-full cursor-pointer items-center justify-center rounded border border-border bg-transparent text-xs text-muted select-none active:bg-hover"
          @click="hud.disconnect"
        >
          Disconnect
        </button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
