<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose,
} from 'reka-ui'
import IconX from '~icons/lucide/x'
import IconSearch from '~icons/lucide/search'
import IconPackage from '~icons/lucide/package'
import IconChevronDown from '~icons/lucide/chevron-down'
import { useKitStore } from '@/stores/kit-store'
import KitCard from './KitCard.vue'
import KitModeToggle from './KitModeToggle.vue'
import ActiveKitsBar from './ActiveKitsBar.vue'
import type { KitMeta } from '../../../packages/format/src/kit-schema'

const open = defineModel<boolean>('open', { default: false })
const store = useKitStore()
const searchTerm = ref('')
const collapsedCategories = ref(new Set<string>())

const filteredKits = computed(() => {
  if (!searchTerm.value) return store.state.installedKits
  const q = searchTerm.value.toLowerCase()
  return store.state.installedKits.filter(
    (k) =>
      k.displayName.toLowerCase().includes(q) ||
      k.tags.some((t) => t.includes(q)) ||
      k.components.some((c) => c.name.toLowerCase().includes(q)),
  )
})

const categories = computed(() => {
  const cats = new Map<string, KitMeta[]>()
  for (const kit of filteredKits.value) {
    const label = categoryLabel(kit.category)
    if (!cats.has(label)) cats.set(label, [])
    cats.get(label)!.push(kit)
  }
  return cats
})

function categoryLabel(cat: string): string {
  switch (cat) {
    case 'general':
      return 'Interfaces g\u00e9n\u00e9rales'
    case 'dashboard':
      return 'Dashboard & Data'
    case 'effects':
      return 'Effets & Animations'
    default:
      return cat
  }
}

function toggleCategory(label: string) {
  const next = new Set(collapsedCategories.value)
  if (next.has(label)) next.delete(label)
  else next.add(label)
  collapsedCategories.value = next
}

function isCategoryCollapsed(label: string): boolean {
  return collapsedCategories.value.has(label)
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
      <DialogContent
        data-test-id="kit-browser-dialog"
        class="fixed top-1/2 left-1/2 z-50 flex w-[800px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-panel shadow-2xl outline-none"
        :style="{ maxHeight: '85vh' }"
      >
        <!-- Header -->
        <div class="sticky top-0 z-10 flex shrink-0 flex-col border-b border-border bg-panel rounded-t-2xl">
          <div class="flex items-center justify-between px-5 py-4">
            <div class="flex items-center gap-2.5">
              <IconPackage class="size-5 text-accent" />
              <DialogTitle class="text-base font-semibold text-surface">UI Kits</DialogTitle>
            </div>

            <div class="flex items-center gap-3">
              <!-- Search -->
              <div class="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5">
                <IconSearch class="size-3.5 text-muted" />
                <input
                  v-model="searchTerm"
                  data-test-id="kit-browser-search"
                  class="w-40 border-none bg-transparent text-xs text-surface outline-none placeholder:text-muted"
                  placeholder="Rechercher un kit..."
                />
              </div>

              <!-- Close -->
              <DialogClose
                data-test-id="kit-browser-close"
                class="flex size-7 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-muted transition-colors hover:bg-hover hover:text-surface"
              >
                <IconX class="size-4" />
              </DialogClose>
            </div>
          </div>

          <!-- Mode toggle -->
          <div class="flex items-center gap-3 border-t border-border/50 px-5 py-2.5">
            <KitModeToggle />
            <span class="text-xs text-muted">
              {{ store.state.installedKits.length }} kit{{ store.state.installedKits.length !== 1 ? 's' : '' }} disponible{{ store.state.installedKits.length !== 1 ? 's' : '' }}
            </span>
          </div>
        </div>

        <!-- Active kits bar (global mode only) -->
        <ActiveKitsBar v-if="store.state.mode === 'global'" />

        <!-- Content -->
        <div class="flex-1 overflow-y-auto px-5 py-4" data-test-id="kit-browser-content">
          <!-- Empty state -->
          <div
            v-if="filteredKits.length === 0"
            class="flex flex-col items-center justify-center py-16"
          >
            <IconPackage class="mb-3 size-10 text-muted/40" />
            <p class="text-sm text-muted">
              {{ searchTerm ? 'Aucun kit trouv\u00e9' : 'Aucun kit install\u00e9' }}
            </p>
          </div>

          <!-- Categories -->
          <div v-else class="flex flex-col gap-6">
            <div
              v-for="[label, kits] in categories"
              :key="label"
              :data-test-id="`kit-category-${label}`"
            >
              <!-- Category header (collapsible) -->
              <button
                class="mb-3 flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-0 text-left"
                :data-test-id="`kit-category-toggle-${label}`"
                @click="toggleCategory(label)"
              >
                <IconChevronDown
                  class="size-4 text-muted transition-transform"
                  :class="isCategoryCollapsed(label) ? '-rotate-90' : ''"
                />
                <span class="text-xs font-semibold uppercase tracking-wide text-muted">
                  {{ label }}
                </span>
                <span class="text-xs text-muted/60">
                  ({{ kits.length }})
                </span>
              </button>

              <!-- Kit grid -->
              <div
                v-if="!isCategoryCollapsed(label)"
                class="grid grid-cols-2 gap-4 sm:grid-cols-3"
              >
                <KitCard v-for="kit in kits" :key="kit.name" :kit="kit" />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
