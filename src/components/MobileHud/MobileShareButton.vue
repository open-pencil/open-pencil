<script setup lang="ts">
import { useMobileHudContext } from '@/components/MobileHud/context'

const hud = useMobileHudContext()
</script>

<template>
  <button
    class="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-panel/70 px-3 shadow-md backdrop-blur-xl select-none active:bg-hover"
    @click="hud.share"
  >
    <icon-lucide-share-2 class="size-3.5 text-surface" />
    <span class="text-xs text-surface">{{ hud.dialogs.share }}</span>
  </button>
</template>
