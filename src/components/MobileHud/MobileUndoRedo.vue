<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import HudButton from '@/components/mobile-hud/HudButton.vue'
import { useMobileHudContext } from '@/components/MobileHud/context'

const { commands } = useI18n()

const hud = useMobileHudContext()
</script>

<template>
  <div class="flex gap-1.5">
    <HudButton icon-only :label="commands.undo" @click="hud.undo">
      <icon-lucide-undo-2 class="size-3.5" />
    </HudButton>
    <HudButton icon-only :label="commands.redo" @click="hud.redo">
      <icon-lucide-redo-2 class="size-3.5" />
    </HudButton>
  </div>
</template>
