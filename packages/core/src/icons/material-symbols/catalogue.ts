import {
  MATERIAL_SYMBOLS_PREFIXES,
  MATERIAL_SYMBOLS_SETS,
  type MaterialSymbolsPrefix
} from '#core/icons/material-symbols/font'

/**
 * Google's Material Symbols repository, where each font's names sit beside it, at a fixed commit so
 * the names cannot move under a release. jsDelivr serves it to any page, which Google's own icon
 * catalogue does not. Moving the commit forward lists the icons Google has added since.
 */
const REPOSITORY =
  'https://cdn.jsdelivr.net/gh/google/material-design-icons@10ecc14790612ca8fd164e3f4ffe9c16fc50d5b7/variablefont'

/** A Material Symbols icon and the sets that draw it. */
export interface MaterialSymbolsEntry {
  name: string
  sets: ReadonlySet<MaterialSymbolsPrefix>
}

/** The names a set's font draws, from the codepoints list Google publishes with it. */
async function fetchSetNames(
  fetcher: typeof globalThis.fetch,
  prefix: MaterialSymbolsPrefix
): Promise<string[]> {
  const file = `${MATERIAL_SYMBOLS_SETS[prefix].replaceAll(' ', '')}[FILL,GRAD,opsz,wght].codepoints`
  const response = await fetcher(`${REPOSITORY}/${encodeURIComponent(file)}`)
  if (!response.ok) throw new Error(`Material Symbols answered ${response.status} for ${prefix}`)
  return (await response.text())
    .split('\n')
    .map((line) => line.split(' ')[0])
    .filter((name) => name !== '')
}

/** Every Material Symbols icon in name order, with the sets that draw it. */
export async function fetchMaterialSymbolsCatalogue(
  fetcher: typeof globalThis.fetch
): Promise<MaterialSymbolsEntry[]> {
  const lists = await Promise.all(
    MATERIAL_SYMBOLS_PREFIXES.map((prefix) => fetchSetNames(fetcher, prefix))
  )
  const sets = new Map<string, Set<MaterialSymbolsPrefix>>()
  MATERIAL_SYMBOLS_PREFIXES.forEach((prefix, index) => {
    for (const name of lists[index] ?? []) {
      const drawn = sets.get(name) ?? new Set()
      drawn.add(prefix)
      sets.set(name, drawn)
    }
  })
  return [...sets]
    .map(([name, drawn]) => ({ name, sets: drawn }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
