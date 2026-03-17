import { shallowReactive, shallowRef, computed } from 'vue'
import type { KitMeta, KitComponent } from '../../packages/format/src/kit-schema'

// Load all kit.json files at build time via Vite's import.meta.glob
const kitModules = import.meta.glob<{ default: KitMeta }>(
  '../../design-kits/installed/*/kit.json',
  { eager: true }
)

function loadInstalledKits(): KitMeta[] {
  const kits: KitMeta[] = []
  for (const [, mod] of Object.entries(kitModules)) {
    const kit = mod.default
    if (!Array.isArray(kit.components)) kit.components = []
    kits.push(kit)
  }
  return kits
}

export type KitMode = 'unitaire' | 'global'

export function createKitStore() {
  const allKits = loadInstalledKits()

  const state = shallowReactive({
    mode: 'global' as KitMode,
    /** In unitaire mode: the single selected kit name. Ignored in global mode. */
    selectedKitId: 'shadcn' as string | null,
    installedKits: allKits,
  })

  /**
   * Active kits depend on the mode:
   * - Global: ALL installed kits are active (AI picks from context)
   * - Unitaire: only the user-selected kit is active
   */
  const activeKits = computed(() => {
    if (state.mode === 'global') return state.installedKits
    if (!state.selectedKitId) return []
    return state.installedKits.filter(k => k.name === state.selectedKitId)
  })

  const activeComponents = computed(() => {
    const components: Array<KitComponent & { kitName: string }> = []
    for (const kit of activeKits.value) {
      for (const comp of kit.components) {
        components.push({ ...comp, kitName: kit.name })
      }
    }
    return components
  })

  const totalComponentCount = computed(() => activeComponents.value.length)

  function setMode(mode: KitMode) {
    state.mode = mode
    // When switching to unitaire, default to shadcn if nothing selected
    if (mode === 'unitaire' && !state.selectedKitId) {
      state.selectedKitId = allKits.find(k => k.name === 'shadcn')?.name ?? allKits[0]?.name ?? null
    }
  }

  /** In unitaire mode: select this kit (replaces previous). In global mode: no-op. */
  function selectKit(kitName: string) {
    state.selectedKitId = kitName
  }

  function isKitActive(kitName: string): boolean {
    if (state.mode === 'global') return true
    return state.selectedKitId === kitName
  }

  function isKitSelected(kitName: string): boolean {
    return state.selectedKitId === kitName
  }

  function getComponentsByContext(usageContext: string): Array<KitComponent & { kitName: string }> {
    return activeComponents.value.filter(c => c.usageContext.includes(usageContext))
  }

  function getComponentsByTag(tag: string): Array<KitComponent & { kitName: string }> {
    return activeComponents.value.filter(c => c.tags.includes(tag))
  }

  return {
    state,
    activeKits,
    activeComponents,
    totalComponentCount,
    setMode,
    selectKit,
    isKitActive,
    isKitSelected,
    getComponentsByContext,
    getComponentsByTag,
  }
}

export type KitStore = ReturnType<typeof createKitStore>

const storeRef = shallowRef<KitStore>()

export function useKitStore(): KitStore {
  if (!storeRef.value) {
    storeRef.value = createKitStore()
  }
  return storeRef.value
}
