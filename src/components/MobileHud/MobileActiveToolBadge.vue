<script setup lang="ts">
import { useMobileHudContext } from '@/components/MobileHud/context'
import { feedbackTransition } from '@/theme/motion/styles'

const hud = useMobileHudContext()
</script>

<template>
  <div
    class="flex size-8 items-center justify-center rounded-full border border-accent/20 bg-panel/70 shadow-md backdrop-blur-xl transition-colors duration-200"
  >
    <Transition mode="out-in" v-bind="feedbackTransition">
      <component
        :is="hud.activeToolIcon"
        :key="hud.store.state.activeTool"
        class="size-3.5 text-accent"
      />
    </Transition>
  </div>
</template>
