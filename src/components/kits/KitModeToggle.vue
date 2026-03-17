<script setup lang="ts">
import { useKitStore } from '@/stores/kit-store'

const store = useKitStore()
</script>

<template>
  <div class="flex items-center gap-0.5 rounded-lg bg-surface/10 p-0.5" data-test-id="kit-mode-toggle">
    <button
      data-test-id="kit-mode-unitaire"
      class="flex h-8 cursor-pointer items-center justify-center rounded-lg border-none px-3 text-xs font-medium transition-colors"
      :class="store.state.mode === 'unitaire' ? 'bg-accent text-white' : 'bg-transparent text-muted hover:text-surface'"
      @click="store.setMode('unitaire')"
    >
      Unitaire
    </button>
    <button
      data-test-id="kit-mode-global"
      class="flex h-8 cursor-pointer items-center justify-center rounded-lg border-none px-3 text-xs font-medium transition-colors"
      :class="store.state.mode === 'global' ? 'bg-accent text-white' : 'bg-transparent text-muted hover:text-surface'"
      @click="store.setMode('global')"
    >
      Global
    </button>
  </div>
</template>
