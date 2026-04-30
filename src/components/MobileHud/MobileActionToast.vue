<script setup lang="ts">
import { useMobileHudContext } from '@/components/MobileHud/context'

const hud = useMobileHudContext()
</script>

<template>
  <Transition
    enter-active-class="animate-in fade-in duration-150"
    leave-active-class="animate-out fade-out duration-200"
  >
    <div
      v-if="hud.actionToast"
      :key="hud.actionToast"
      class="flex h-8 items-center rounded-full border border-accent/20 bg-panel/70 px-3 shadow-md backdrop-blur-xl"
    >
      <span class="text-xs whitespace-nowrap text-accent">{{ hud.actionToast }}</span>
    </div>
  </Transition>
</template>
