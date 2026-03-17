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
    kits.push(mod.default)
  }
  return kits
}

export type KitMode = 'unitaire' | 'global'

export function createKitStore() {
  const allKits = loadInstalledKits()

  const state = shallowReactive({
    mode: 'global' as KitMode,
    activeKitIds: new Set<string>(
      // Auto-activate shadcn by default
      allKits.find(k => k.name === 'shadcn') ? ['shadcn'] : []
    ),
    installedKits: allKits,
    registryLoaded: true,
  })

  const activeKits = computed(() =>
    state.installedKits.filter(k => state.activeKitIds.has(k.name))
  )

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
    if (mode === 'unitaire' && state.activeKitIds.size > 1) {
      const first = state.activeKitIds.values().next().value
      state.activeKitIds = new Set(first ? [first] : [])
    }
  }

  function activateKit(kitName: string) {
    if (state.mode === 'unitaire') {
      state.activeKitIds = new Set([kitName])
    } else {
      const next = new Set(state.activeKitIds)
      next.add(kitName)
      state.activeKitIds = next
    }
  }

  function deactivateKit(kitName: string) {
    const next = new Set(state.activeKitIds)
    next.delete(kitName)
    state.activeKitIds = next
  }

  function isKitActive(kitName: string): boolean {
    return state.activeKitIds.has(kitName)
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
    activateKit,
    deactivateKit,
    isKitActive,
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
