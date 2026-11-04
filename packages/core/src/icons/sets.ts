import type { IconOptions } from '@open-pencil/scene-graph/icons'

import { parseIconName, type IconProvider } from '#core/icons/provider'
import type { IconCollection, IconData, IconSearchResult } from '#core/icons/types'

/** A provider of its own for some sets, such as fonts we draw icons from ourselves. */
export interface IconSetSource {
  prefixes: readonly string[]
  provider: IconProvider
}

export interface IconSetsOptions {
  /** Sets served by a source of their own instead of the fallback. */
  sources: readonly IconSetSource[]
  /** Everything else, such as Iconify. */
  fallback: IconProvider
  /**
   * The fallback's sets a source replaces, left out of its catalogue and searches; icons already
   * placed from them are still drawn.
   */
  replaced?: readonly string[]
}

/**
 * One provider over several: each icon name is answered by the source that owns its set, and
 * everything else by the fallback. Searches over every set ask them all.
 */
export function createIconSetsProvider({
  sources,
  fallback,
  replaced = []
}: IconSetsOptions): IconProvider {
  const owner = (prefix: string): IconProvider =>
    sources.find((source) => source.prefixes.includes(prefix))?.provider ?? fallback
  const shown = (name: string) => !replaced.includes(parseIconName(name)?.prefix ?? '')

  /** `names` split by the provider that answers them, in the order they were given. */
  function byProvider(names: readonly string[]): Map<IconProvider, string[]> {
    const parts = new Map<IconProvider, string[]>()
    for (const name of names) {
      const provider = owner(parseIconName(name)?.prefix ?? '')
      parts.set(provider, [...(parts.get(provider) ?? []), name])
    }
    return parts
  }

  /** What every provider answers for its names; one that fails leaves only its own out. */
  async function answered<T>(
    names: readonly string[],
    ask: (provider: IconProvider, names: string[]) => Promise<Map<string, T>>
  ): Promise<Map<string, T>> {
    const parts = await Promise.allSettled(
      [...byProvider(names)].map(([provider, part]) => ask(provider, part))
    )
    const failed = parts.find((part) => part.status === 'rejected')
    if (failed && parts.every((part) => part.status === 'rejected')) throw failed.reason
    return new Map(parts.flatMap((part) => (part.status === 'fulfilled' ? [...part.value] : [])))
  }

  return {
    async search(query, options = {}): Promise<IconSearchResult> {
      if (options.prefix && replaced.includes(options.prefix))
        return { icons: [], total: 0, collections: {} }
      if (options.prefix) return owner(options.prefix).search(query, options)
      const results = await Promise.allSettled(
        [fallback, ...sources.map((source) => source.provider)].map((provider) =>
          provider.search(query, options)
        )
      )
      const found = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : []
      )
      if (found.length === 0 && results[0]?.status === 'rejected') throw results[0].reason
      // The sources take turns, so one with many matches cannot crowd the others past the limit.
      const lists = found.map((result) => result.icons.filter(shown))
      const longest = Math.max(0, ...lists.map((list) => list.length))
      const icons = Array.from({ length: longest }, (_, index) =>
        lists.flatMap((list) => (index < list.length ? [list[index]] : []))
      )
        .flat()
        .slice(0, options.limit)
      return {
        icons,
        total: icons.length,
        collections: Object.fromEntries(
          found
            .flatMap((result) => Object.entries(result.collections))
            .filter(([prefix]) => !replaced.includes(prefix))
        )
      }
    },

    icons(names, size, options?: IconOptions) {
      return answered<IconData>(names, (provider, part) => provider.icons(part, size, options))
    },

    previews(names) {
      return answered<string>(names, (provider, part) => provider.previews(part))
    },

    async collections(): Promise<IconCollection[]> {
      const lists = await Promise.allSettled(
        [fallback, ...sources.map((source) => source.provider)].map((provider) =>
          provider.collections()
        )
      )
      const listed = lists.flatMap((list) => (list.status === 'fulfilled' ? list.value : []))
      if (listed.length === 0 && lists[0]?.status === 'rejected') throw lists[0].reason
      return listed.filter((info) => !replaced.includes(info.prefix))
    },

    async browse(prefix) {
      return replaced.includes(prefix) ? [] : owner(prefix).browse(prefix)
    }
  }
}
