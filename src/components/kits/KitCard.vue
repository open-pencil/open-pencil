<script setup lang="ts">
import { computed } from 'vue'
import IconCheck from '~icons/lucide/check'
import IconPlus from '~icons/lucide/plus'
import { useKitStore } from '@/stores/kit-store'
import type { KitMeta } from '../../../packages/format/src/kit-schema'

const props = defineProps<{ kit: KitMeta }>()
const store = useKitStore()
const isActive = computed(() => store.isKitActive(props.kit.name))

const gradientStyle = computed(() => {
  const scheme = props.kit.style.colorScheme
  switch (scheme) {
    case 'neutral':
      return 'background: linear-gradient(135deg, #374151, #1f2937)'
    case 'vibrant':
      return 'background: linear-gradient(135deg, #7c3aed, #2563eb)'
    case 'monochrome':
      return 'background: linear-gradient(135deg, #27272a, #18181b)'
    case 'pastel':
      return 'background: linear-gradient(135deg, #c4b5fd, #93c5fd)'
    default:
      return 'background: linear-gradient(135deg, #374151, #1f2937)'
  }
})

function toggle() {
  if (isActive.value) store.deactivateKit(props.kit.name)
  else store.activateKit(props.kit.name)
}
</script>

<template>
  <div
    class="flex flex-col overflow-hidden rounded-xl border transition-colors"
    :class="isActive ? 'border-accent' : 'border-border hover:border-accent/50'"
    :data-test-id="`kit-card-${kit.name}`"
  >
    <!-- Preview strip -->
    <div class="h-24 w-full rounded-t-xl" :style="gradientStyle" />

    <!-- Content -->
    <div class="flex flex-1 flex-col gap-2 bg-panel p-4">
      <!-- Kit name -->
      <p class="text-sm font-semibold text-surface" data-test-id="kit-card-name">
        {{ kit.displayName }}
      </p>

      <!-- Component count -->
      <p class="text-xs text-muted">
        {{ kit.stats.componentCount }} composant{{ kit.stats.componentCount !== 1 ? 's' : '' }}
      </p>

      <!-- Tags -->
      <div v-if="kit.tags.length > 0" class="flex flex-wrap gap-1">
        <span
          v-for="tag in kit.tags.slice(0, 4)"
          :key="tag"
          class="rounded-full bg-hover px-2 py-0.5 text-[11px] text-muted"
        >
          {{ tag }}
        </span>
      </div>

      <!-- Toggle button -->
      <button
        class="mt-1 flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors"
        :class="
          isActive
            ? 'border-none bg-accent text-white'
            : 'border border-border bg-transparent text-muted hover:border-accent/50 hover:text-surface'
        "
        :data-test-id="`kit-toggle-${kit.name}`"
        @click="toggle"
      >
        <IconCheck v-if="isActive" class="size-3.5" />
        <IconPlus v-else class="size-3.5" />
        {{ isActive ? 'Active' : 'Ajouter' }}
      </button>
    </div>
  </div>
</template>
