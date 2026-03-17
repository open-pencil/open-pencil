import { shallowReactive, shallowRef, computed } from 'vue'
import type { KitMeta, KitComponent, KitRegistry } from '../../packages/format/src/kit-schema'

export type KitMode = 'unitaire' | 'global'

export function createKitStore() {
  const state = shallowReactive({
    mode: 'global' as KitMode,
    activeKitIds: new Set<string>(),
    installedKits: [] as KitMeta[],
    registryLoaded: false,
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
      // Keep only the first active kit
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

  async function loadRegistry() {
    try {
      const response = await fetch('/design-kits/registry.json')
      const registry: KitRegistry = await response.json()

      const kits: KitMeta[] = []
      for (const entry of registry.kits) {
        const kitResponse = await fetch(`/design-kits/installed/${entry.name}/kit.json`)
        const kitMeta: KitMeta = await kitResponse.json()
        kits.push(kitMeta)
      }

      state.installedKits = kits
      state.registryLoaded = true

      // Auto-activate shadcn if it exists and nothing is active
      if (state.activeKitIds.size === 0) {
        const shadcn = kits.find(k => k.name === 'shadcn')
        if (shadcn) activateKit(shadcn.name)
      }
    } catch {
      // Registry not available yet — that's fine
      state.registryLoaded = true
    }
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
    loadRegistry,
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
