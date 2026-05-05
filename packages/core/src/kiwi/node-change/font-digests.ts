import type { SceneGraph } from '#core/scene-graph'
import { fontManager, weightToStyle } from '#core/text/fonts'

const fontDigestCache = new Map<string, Uint8Array>()

async function computeFontDigest(data: ArrayBuffer): Promise<Uint8Array> {
  if (typeof crypto !== 'undefined') {
    const hash = await crypto.subtle.digest('SHA-1', data)
    return new Uint8Array(hash)
  }
  return new Uint8Array(20)
}

async function getFontDigest(family: string, style: string): Promise<Uint8Array | null> {
  const key = `${family}|${style}`
  const cached = fontDigestCache.get(key)
  if (cached) return cached
  const data = fontManager.loadedData(family, style)
  if (!data) return null
  const digest = await computeFontDigest(data)
  fontDigestCache.set(key, digest)
  return digest
}

export async function buildFontDigestMap(graph: SceneGraph): Promise<Map<string, Uint8Array>> {
  const fontKeys = new Set<string>()
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'TEXT') continue
    const baseStyle = weightToStyle(node.fontWeight, node.italic)
    fontKeys.add(`${node.fontFamily}|${baseStyle}`)
    for (const run of node.styleRuns) {
      const family = run.style.fontFamily ?? node.fontFamily
      const weight = run.style.fontWeight ?? node.fontWeight
      const italic = run.style.italic ?? node.italic
      fontKeys.add(`${family}|${weightToStyle(weight, italic)}`)
    }
  }

  const result = new Map<string, Uint8Array>()
  for (const key of fontKeys) {
    const [family, style] = key.split('|')
    const digest = await getFontDigest(family, style)
    if (digest) result.set(key, digest)
  }
  return result
}
