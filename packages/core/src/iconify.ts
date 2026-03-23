import svgpath from 'svgpath'
import { iconToSVG } from '@iconify/utils'

import { parseSVGPath } from './svg-path-parse'
import { extractPaths } from './svg-import'

import type { VectorNetwork } from './scene-graph'

const ICONIFY_API = 'https://api.iconify.design'
const FETCH_TIMEOUT_MS = 10_000

export interface IconPath {
  vectorNetwork: VectorNetwork
  fill: string | null
  stroke: string | null
  strokeWidth: number
  strokeCap: string
  strokeJoin: string
}

export interface IconData {
  prefix: string
  name: string
  width: number
  height: number
  paths: IconPath[]
}

interface IconifyIconEntry {
  body: string
  width?: number
  height?: number
}

interface IconifyResponse {
  prefix: string
  width?: number
  height?: number
  icons: { [key: string]: IconifyIconEntry | undefined }
  aliases?: { [key: string]: { parent: string } | undefined }
}

const iconCache = new Map<string, IconData>()

export function clearIconCache(): void {
  iconCache.clear()
}

function parseIconName(name: string): { prefix: string; iconName: string } {
  const colonIdx = name.indexOf(':')
  if (colonIdx === -1) {
    throw new Error(`Invalid icon name "${name}". Use prefix:name format (e.g. lucide:heart, mdi:home)`)
  }
  return { prefix: name.slice(0, colonIdx), iconName: name.slice(colonIdx + 1) }
}

function buildIconData(
  iconEntry: IconifyIconEntry,
  prefix: string,
  iconName: string,
  defaultW: number,
  defaultH: number,
  size: number
): IconData {
  const rendered = iconToSVG({
    body: iconEntry.body,
    width: iconEntry.width ?? defaultW,
    height: iconEntry.height ?? defaultH
  })
  const [, , vbW, vbH] = rendered.viewBox
  const sx = size / vbW
  const sy = size / vbH

  const pathInfos = extractPaths(rendered.body)

  return {
    prefix,
    name: iconName,
    width: size,
    height: size,
    paths: pathInfos.map((p) => {
      const scaledD = (sx === 1 && sy === 1) ? p.d : svgpath(p.d).scale(sx, sy).round(2).toString()
      return {
        vectorNetwork: parseSVGPath(scaledD, p.fillRule),
        fill: p.fill,
        stroke: p.stroke,
        strokeWidth: p.strokeWidth * Math.min(sx, sy),
        strokeCap: p.strokeCap,
        strokeJoin: p.strokeJoin
      }
    })
  }
}

function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
}

export async function fetchIcon(name: string, size = 24): Promise<IconData> {
  const results = await fetchIcons([name], size)
  const result = results.get(name)
  if (!result) throw new Error(`Icon "${name}" not found. Check the name at https://icon-sets.iconify.design/`)
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
    const url = `${ICONIFY_API}/${prefix}.json?icons=${iconNames.map(encodeURIComponent).join(',')}`
    const response = await fetchWithTimeout(url)
    if (!response.ok) throw new Error(`Iconify API error: ${response.status} for prefix "${prefix}"`)
    const data = (await response.json()) as IconifyResponse
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

export interface IconSearchResult {
  icons: string[]
  total: number
  collections: Record<string, { name: string; total: number; category?: string }>
}

export async function searchIcons(query: string, options?: {
  limit?: number
  prefix?: string
}): Promise<IconSearchResult> {
  const params = new URLSearchParams({ query })
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.prefix) params.set('prefix', options.prefix)

  const response = await fetchWithTimeout(`${ICONIFY_API}/search?${params}`)
  if (!response.ok) throw new Error(`Iconify search error: ${response.status}`)
  const data = await response.json()
  const icons: string[] = data.icons ?? []
  const limit = options?.limit ?? 5
  return {
    icons: icons.slice(0, limit),
    total: data.total ?? 0,
    collections: data.collections ?? {}
  }
}

export async function searchIconsBatch(queries: string[], options?: {
  limit?: number
  prefix?: string
}): Promise<Map<string, IconSearchResult>> {
  const results = new Map<string, IconSearchResult>()
  await Promise.all(queries.map(async (query) => {
    const result = await searchIcons(query, options)
    results.set(query, result)
  }))
  return results
}
