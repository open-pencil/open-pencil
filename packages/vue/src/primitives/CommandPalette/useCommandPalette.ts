import { groupBy, take } from 'es-toolkit/array'
import Fuse from 'fuse.js'
import { computed, ref, type MaybeRefOrGetter, toValue } from 'vue'

import type { CommandPaletteGroup, CommandPaletteItem, UseCommandPaletteOptions } from './types'

function searchItems(
  items: CommandPaletteItem[],
  query: string,
  resultLimit: number
): CommandPaletteItem[] {
  if (!query)
    return take(
      items.filter((item) => !item.searchOnly),
      resultLimit
    )

  return new Fuse(items, {
    keys: ['label', 'description', 'keywords'],
    threshold: 0.2,
    ignoreLocation: true
  })
    .search(query)
    .slice(0, resultLimit)
    .map((result) => result.item)
}

function filterGroups(
  groups: CommandPaletteGroup[],
  results: CommandPaletteItem[]
): CommandPaletteGroup[] {
  const groupByItem = new Map(
    groups.flatMap((group) => group.items.map((item) => [item, group.id] as const))
  )
  const groupedResults = groupBy(results, (item) => groupByItem.get(item) ?? '')

  return groups
    .map((group) => ({ ...group, items: groupedResults[group.id] ?? [] }))
    .filter((group) => group.items.length > 0)
}

export function useCommandPalette(options: MaybeRefOrGetter<UseCommandPaletteOptions>) {
  const searchTerm = ref('')
  const selectedId = ref<string>()
  const navigation = ref<CommandPaletteGroup[]>([])

  const groups = computed(() => toValue(options).groups)
  const resultLimit = computed(() => toValue(options).resultLimit ?? 12)
  const currentGroups = computed(() => {
    const current = navigation.value.at(-1)
    return current ? [current] : groups.value
  })
  const items = computed(() => currentGroups.value.flatMap((group) => group.items))
  const isNested = computed(() => navigation.value.length > 0)
  const filteredGroups = computed(() => {
    const query = searchTerm.value.trim()
    // A step the user opened, like a page list, shows all of its items until they search.
    const limit = isNested.value && !query ? Number.POSITIVE_INFINITY : resultLimit.value
    return filterGroups(currentGroups.value, searchItems(items.value, query, limit))
  })

  function resetNavigation() {
    navigation.value = []
    searchTerm.value = ''
    selectedId.value = undefined
  }

  function close() {
    resetNavigation()
  }

  function navigate(item: CommandPaletteItem): boolean {
    if (!item.children?.length) return false
    navigation.value.push({ id: item.id, label: item.label, items: item.children })
    searchTerm.value = ''
    selectedId.value = undefined
    return true
  }

  function navigateBack(): boolean {
    if (navigation.value.length === 0) return false
    navigation.value.pop()
    searchTerm.value = ''
    selectedId.value = undefined
    return true
  }

  /** Run `item`, or open its children. Returns whether a command ran. */
  function select(item: CommandPaletteItem): boolean {
    if (item.disabled || navigate(item)) return false
    selectedId.value = item.id
    item.onSelect?.()
    close()
    return true
  }

  return {
    searchTerm,
    selectedId,
    filteredGroups,
    isNested,
    close,
    navigate,
    navigateBack,
    select
  }
}
