<script setup lang="ts">
import Tip from '@/components/ui/Tip.vue'
import { useMobileHudContext } from '@/components/MobileHud/context'

const hud = useMobileHudContext()
</script>

<template>
  <div class="flex gap-1.5">
    <Tip label="Undo">
      <button
        class="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-panel/70 shadow-md backdrop-blur-xl select-none active:bg-hover"
        @click="hud.undo"
      >
        <icon-lucide-undo-2 class="size-3.5 text-surface" />
      </button>
    </Tip>
    <Tip label="Redo">
      <button
        class="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-panel/70 shadow-md backdrop-blur-xl select-none active:bg-hover"
        @click="hud.redo"
      >
        <icon-lucide-redo-2 class="size-3.5 text-surface" />
      </button>
    </Tip>
  </div>
</template>
