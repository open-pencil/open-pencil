import type { FontFallbackScript } from '#core/text/fallbacks'

interface CJKFallbackFamilySource {
  getCJKFallbackFamilies(): string[]
  getDirectFallbackFamiliesForScript(script: FontFallbackScript): string[]
  getFallbackFamiliesForScript(script: FontFallbackScript): string[]
}

export function cjkFallbackFamiliesForScripts(
  source: CJKFallbackFamilySource,
  scripts: readonly FontFallbackScript[]
): string[] {
  const requested = scripts.filter((script) => script !== 'arabic')
  if (requested.length === 0) return source.getCJKFallbackFamilies()

  const generic = source.getDirectFallbackFamiliesForScript('cjk')
  const families: string[] = []
  const add = (family: string) => {
    if (!families.includes(family)) families.push(family)
  }

  for (const script of requested) {
    if (script === 'cjk') continue
    for (const family of source.getDirectFallbackFamiliesForScript(script)) add(family)
  }
  for (const family of generic) add(family)
  return families
}
