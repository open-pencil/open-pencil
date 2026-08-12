import { textFallbackScriptsWithoutCoverage, textNeededFallbackScripts } from '#core/text/coverage'
import type { FontFallbackScript } from '#core/text/fallbacks'
import type { GraphFontRequirements } from '#core/text/requirements'

export interface MissingGraphFontScriptsOptions {
  treatUnknownCoverageAsMissing?: boolean
}

export function missingGraphFontScripts(
  requirements: GraphFontRequirements,
  options: MissingGraphFontScriptsOptions = {}
): FontFallbackScript[] {
  const scripts = new Set<FontFallbackScript>()
  for (const node of requirements.nodes) {
    if (node.type !== 'TEXT') continue
    const neededScripts = options.treatUnknownCoverageAsMissing
      ? textFallbackScriptsWithoutCoverage(node)
      : textNeededFallbackScripts(node)
    for (const script of neededScripts) scripts.add(script)
  }
  return Array.from(scripts)
}
