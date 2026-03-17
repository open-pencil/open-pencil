<script setup lang="ts">
import { ref, computed } from 'vue'
import IconArrowLeft from '~icons/lucide/arrow-left'
import IconCheck from '~icons/lucide/check'
import IconPlus from '~icons/lucide/plus'
import { useKitStore } from '@/stores/kit-store'
import type { KitMeta } from '../../../packages/format/src/kit-schema'

const { kit } = defineProps<{ kit: KitMeta }>()
const emit = defineEmits<{ back: [] }>()

const store = useKitStore()
const isActive = computed(() => store.isKitActive(kit.name))
const activeFilter = ref('All')

function toggleKit() {
  if (isActive.value) store.deactivateKit(kit.name)
  else store.activateKit(kit.name)
}

// Per-kit distinctive gradient (matches KitCard)
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

// Collect all unique tags across components for filter tabs
const filterTabs = computed(() => {
  const tags = new Set<string>()
  for (const comp of kit.components) {
    for (const tag of comp.tags) tags.add(tag)
  }
  return ['All', ...Array.from(tags)]
})

const filteredComponents = computed(() => {
  if (activeFilter.value === 'All') return kit.components
  return kit.components.filter((c) => c.tags.includes(activeFilter.value))
})

// Extract accent color from gradient midpoint for dot indicators
const KIT_ACCENTS: Record<string, string> = {
  shadcn: '#71717A',
  aceternity: '#6366F1',
  tremor: '#3B82F6',
  radix: '#3E63DD',
  daisyui: '#661AE6',
  nextui: '#006FEE',
  parkui: '#78716C',
  magicui: '#8B5CF6',
  'motion-primitives': '#A855F7',
  saasui: '#3B82F6',
  nivo: '#818CF8',
  luxeui: '#C9A96E',
  indieui: '#FF6B35',
}

const accentColor = computed(() => KIT_ACCENTS[kit.name] ?? '#6366F1')
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden" data-test-id="kit-detail">
    <!-- Back button -->
    <div class="shrink-0 px-5 pt-4 pb-2">
      <button
        class="flex cursor-pointer items-center gap-1.5 border-none bg-transparent px-0 text-xs font-medium text-muted transition-colors hover:text-surface"
        data-test-id="kit-detail-back"
        @click="emit('back')"
      >
        <IconArrowLeft class="size-3.5" />
        Back
      </button>
    </div>

    <!-- Scrollable body -->
    <div class="flex-1 overflow-y-auto">
      <!-- Gradient preview banner -->
      <div
        class="relative mx-5 mb-5 flex h-40 items-center justify-center overflow-hidden rounded-xl"
        :style="gradientStyle"
        data-test-id="kit-detail-preview"
      >
        <!-- Ghost name watermark -->
        <span
          class="pointer-events-none select-none text-[clamp(2.5rem,8vw,4.5rem)] font-black uppercase leading-none tracking-tight text-white/10"
          aria-hidden="true"
        >
          {{ kit.displayName }}
        </span>
        <!-- Subtle noise overlay -->
        <div
          class="pointer-events-none absolute inset-0 opacity-[0.03]"
          style="background-image: url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
        />
      </div>

      <!-- Kit info -->
      <div class="px-5">
        <!-- Name + toggle -->
        <div class="mb-2 flex items-start justify-between gap-3">
          <h2
            class="text-xl font-bold leading-tight text-surface"
            data-test-id="kit-detail-name"
          >
            {{ kit.displayName }}
          </h2>

          <button
            class="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
            :class="
              isActive
                ? 'border-none bg-accent text-white shadow-[0_0_12px_rgba(var(--accent-rgb,99,102,241),0.35)]'
                : 'border border-border bg-transparent text-muted hover:border-accent/50 hover:text-surface'
            "
            :data-test-id="`kit-detail-toggle-${kit.name}`"
            @click="toggleKit"
          >
            <IconCheck v-if="isActive" class="size-3.5" />
            <IconPlus v-else class="size-3.5" />
            {{ isActive ? 'Activated' : 'Add Kit' }}
          </button>
        </div>

        <!-- Description -->
        <p class="mb-3 text-sm leading-relaxed text-muted" data-test-id="kit-detail-description">
          {{ kit.description }}
        </p>

        <!-- Stats -->
        <p class="mb-3 text-xs text-muted/70" data-test-id="kit-detail-stats">
          {{ kit.stats.componentCount }} component{{ kit.stats.componentCount !== 1 ? 's' : '' }}
          <span class="mx-1.5 opacity-40">&middot;</span>
          {{ kit.stats.variantCount }} variant{{ kit.stats.variantCount !== 1 ? 's' : '' }}
          <span class="mx-1.5 opacity-40">&middot;</span>
          {{ kit.license }}
        </p>

        <!-- Tags -->
        <div v-if="kit.tags.length > 0" class="mb-5 flex flex-wrap gap-1.5" data-test-id="kit-detail-tags">
          <span
            v-for="tag in kit.tags"
            :key="tag"
            class="rounded-full border border-border/60 bg-hover px-2.5 py-0.5 text-[11px] font-medium text-muted"
          >
            {{ tag }}
          </span>
        </div>

        <!-- Section divider -->
        <div class="mb-4 flex items-center gap-3">
          <span class="text-xs font-semibold uppercase tracking-widest text-muted/60">Components</span>
          <div class="h-px flex-1 bg-border/50" />
        </div>

        <!-- Filter tabs -->
        <div
          class="mb-4 flex flex-wrap gap-1"
          role="tablist"
          data-test-id="kit-detail-filters"
        >
          <button
            v-for="tab in filterTabs"
            :key="tab"
            role="tab"
            class="relative cursor-pointer rounded-md border-none bg-transparent px-2.5 py-1 text-xs font-medium transition-colors"
            :class="
              activeFilter === tab
                ? 'text-surface'
                : 'text-muted hover:text-surface/80'
            "
            :aria-selected="activeFilter === tab"
            :data-test-id="`kit-filter-${tab}`"
            @click="activeFilter = tab"
          >
            {{ tab }}
            <!-- Active underline indicator -->
            <span
              v-if="activeFilter === tab"
              class="absolute inset-x-1.5 bottom-0 h-0.5 rounded-full bg-accent transition-all duration-200"
            />
          </button>
        </div>

        <!-- Component grid -->
        <div
          class="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-4"
          data-test-id="kit-detail-component-grid"
        >
          <div
            v-for="comp in filteredComponents"
            :key="comp.id"
            class="group flex flex-col gap-1 rounded-lg border border-border/60 bg-panel p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-hover/50"
            :data-test-id="`kit-component-${comp.id}`"
          >
            <!-- Accent dot + name row -->
            <div class="flex items-center gap-1.5">
              <span
                class="size-1.5 shrink-0 rounded-full opacity-70 transition-opacity group-hover:opacity-100"
                :style="{ backgroundColor: accentColor }"
              />
              <span class="truncate text-xs font-medium text-surface">{{ comp.name }}</span>
            </div>
            <!-- Variant count -->
            <span class="text-[11px] text-muted/60">
              <template v-if="comp.variants && comp.variants.length > 0">
                {{ comp.variants.length }} variant{{ comp.variants.length !== 1 ? 's' : '' }}
              </template>
              <template v-else>
                &mdash;
              </template>
            </span>
          </div>

          <!-- Empty state for filtered view -->
          <div
            v-if="filteredComponents.length === 0"
            class="col-span-full py-8 text-center text-xs text-muted"
          >
            No components match this filter.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
