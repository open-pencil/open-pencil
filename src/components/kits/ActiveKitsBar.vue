<script setup lang="ts">
import { useKitStore } from '@/stores/kit-store'

const store = useKitStore()
</script>

<template>
  <!-- Global mode: all kits, AI picks -->
  <div
    v-if="store.state.mode === 'global'"
    class="flex items-center gap-2 border-b border-border/50 px-5 py-2"
    data-test-id="active-kits-bar"
  >
    <span class="size-2 shrink-0 animate-pulse rounded-full bg-accent" />
    <span class="text-xs text-muted">
      {{ store.state.installedKits.length }} kits actifs — {{ store.totalComponentCount.value }} composants — l'IA choisit selon le contexte
    </span>
  </div>

  <!-- Unitaire mode: show selected kit -->
  <div
    v-else-if="store.state.selectedKitId"
    class="flex items-center gap-2 border-b border-border/50 px-5 py-2"
    data-test-id="active-kits-bar"
  >
    <span class="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
      {{ store.activeKits.value[0]?.displayName ?? store.state.selectedKitId }}
    </span>
    <span class="text-xs text-muted">
      {{ store.totalComponentCount.value }} composant{{ store.totalComponentCount.value !== 1 ? 's' : '' }}
    </span>
  </div>
</template>
