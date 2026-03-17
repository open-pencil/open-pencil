<script setup lang="ts">
import { computed } from 'vue'
import IconCheck from '~icons/lucide/check'
import IconPlus from '~icons/lucide/plus'
import { useKitStore } from '@/stores/kit-store'
import type { KitMeta } from '../../../packages/format/src/kit-schema'

const { kit } = defineProps<{ kit: KitMeta }>()
const emit = defineEmits<{ select: [kit: KitMeta] }>()

const store = useKitStore()
const isActive = computed(() => store.isKitActive(kit.name))

const KIT_GRADIENTS: Record<string, string> = {
  shadcn: 'linear-gradient(135deg, #18181B 0%, #3F3F46 50%, #18181B 100%)',
  aceternity: 'linear-gradient(135deg, #1a0533 0%, #6366F1 50%, #8B5CF6 100%)',
  tremor: 'linear-gradient(135deg, #0F172A 0%, #3B82F6 50%, #0F172A 100%)',
  radix: 'linear-gradient(135deg, #111113 0%, #3E63DD 50%, #111113 100%)',
  daisyui: 'linear-gradient(135deg, #191D24 0%, #661AE6 50%, #D926AA 100%)',
  nextui: 'linear-gradient(135deg, #000000 0%, #006FEE 50%, #9353D3 100%)',
  parkui: 'linear-gradient(135deg, #0C0A09 0%, #57534E 50%, #0C0A09 100%)',
  magicui: 'linear-gradient(135deg, #030712 0%, #8B5CF6 50%, #06B6D4 100%)',
  'motion-primitives': 'linear-gradient(135deg, #09090B 0%, #A855F7 50%, #F472B6 100%)',
  saasui: 'linear-gradient(135deg, #0F172A 0%, #3B82F6 50%, #22C55E 100%)',
  nivo: 'linear-gradient(135deg, #0F172A 0%, #818CF8 50%, #34D399 100%)',
  luxeui: 'linear-gradient(135deg, #0A0A0A 0%, #C9A96E 50%, #0A0A0A 100%)',
  indieui: 'linear-gradient(135deg, #0F0F0F 0%, #FF6B35 50%, #7C3AED 100%)',
}

const gradientStyle = computed(() => {
  const g = KIT_GRADIENTS[kit.name] ?? 'linear-gradient(135deg, #1a1a2e 0%, #6366F1 50%, #1a1a2e 100%)'
  return { background: g }
})

function toggle() {
  if (isActive.value) store.deactivateKit(kit.name)
  else store.activateKit(kit.name)
}
</script>

<template>
  <div
    class="flex cursor-pointer flex-col overflow-hidden rounded-xl border transition-all duration-150 hover:-translate-y-0.5"
    :class="isActive ? 'border-accent' : 'border-border hover:border-accent/50'"
    :data-test-id="`kit-card-${kit.name}`"
    @click="emit('select', kit)"
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
        @click.stop="toggle"
      >
        <IconCheck v-if="isActive" class="size-3.5" />
        <IconPlus v-else class="size-3.5" />
        {{ isActive ? 'Active' : 'Ajouter' }}
      </button>
    </div>
  </div>
</template>
