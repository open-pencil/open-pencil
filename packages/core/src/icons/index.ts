import { fetchIconifyCollection, searchIconify } from './api'
import { buildIconData } from './svg'
import type { IconData, IconSearchResult } from './types'

export type { IconData, IconPath, IconSearchResult } from './types'

const iconCache = new Map<string, IconData>()

export function clearIconCache(): void {
  iconCache.clear()
}

function parseIconName(name: string): { prefix: string; iconName: string } {
  const colonIdx = name.indexOf(':')
  if (colonIdx === -1) {
    throw new Error(
      `Invalid icon name "${name}". Use prefix:name format (e.g. lucide:heart, mdi:home)`
    )
  }
  return { prefix: name.slice(0, colonIdx), iconName: name.slice(colonIdx + 1) }
}

export async function fetchIcon(name: string, size = 24): Promise<IconData> {
  const results = await fetchIcons([name], size)
  const result = results.get(name)
  if (!result)
    throw new Error(`Icon "${name}" not found. Check the name at https://icon-sets.iconify.design/`)
  return result
}

export async function fetchIcons(names: string[], size = 24): Promise<Map<string, IconData>> {
  const results = new Map<string, IconData>()
  const toFetch = new Map<string, string[]>()

  for (const name of names) {
    const cacheKey = `${name}@${size}`
    const cached = iconCache.get(cacheKey)
    if (cached) {
      results.set(name, cached)
      continue
    }
    const { prefix, iconName } = parseIconName(name)
    const group = toFetch.get(prefix) ?? []
    group.push(iconName)
    toFetch.set(prefix, group)
  }

  const fetches = [...toFetch.entries()].map(async ([prefix, iconNames]) => {
    const data = await fetchIconifyCollection(prefix, iconNames)
    const defaultW = data.width ?? 24
    const defaultH = data.height ?? 24

    for (const iconName of iconNames) {
      const fullName = `${prefix}:${iconName}`
      let entry = data.icons[iconName]
      if (!entry) {
        const alias = data.aliases?.[iconName]
        if (alias) entry = data.icons[alias.parent]
      }
      if (!entry) continue
      const iconData = buildIconData(entry, prefix, iconName, defaultW, defaultH, size)
      iconCache.set(`${fullName}@${size}`, iconData)
      results.set(fullName, iconData)
    }
  })

  await Promise.all(fetches)
  return results
}

export async function searchIcons(
  query: string,
  options?: {
    limit?: number
    prefix?: string
  }
): Promise<IconSearchResult> {
  return searchIconify(query, options)
}

export async function searchIconsBatch(
  queries: string[],
  options?: {
    limit?: number
    prefix?: string
  }
): Promise<Map<string, IconSearchResult>> {
  const results = new Map<string, IconSearchResult>()
  await Promise.all(
    queries.map(async (query) => {
      const result = await searchIcons(query, options)
      results.set(query, result)
    })
  )
  return results
}
