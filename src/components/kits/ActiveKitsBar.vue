<script setup lang="ts">
import IconX from '~icons/lucide/x'
import { useKitStore } from '@/stores/kit-store'

const store = useKitStore()
</script>

<template>
  <div
    v-if="store.activeKits.value.length > 0"
    class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2"
    data-test-id="active-kits-bar"
  >
    <div
      v-for="kit in store.activeKits.value"
      :key="kit.name"
      class="flex items-center gap-1 rounded-full bg-accent/15 px-2.5 text-xs font-medium text-accent"
      :data-test-id="`active-kit-chip-${kit.name}`"
    >
      <span class="leading-7">{{ kit.displayName }}</span>
      <button
        class="flex size-4 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-accent/70 transition-colors hover:bg-accent/20 hover:text-accent"
        :data-test-id="`active-kit-remove-${kit.name}`"
        @click="store.deactivateKit(kit.name)"
      >
        <IconX class="size-2.5" />
      </button>
    </div>
    <span class="text-xs text-muted" data-test-id="active-kits-count">
      {{ store.totalComponentCount.value }} composant{{ store.totalComponentCount.value !== 1 ? 's' : '' }}
    </span>
  </div>
</template>
