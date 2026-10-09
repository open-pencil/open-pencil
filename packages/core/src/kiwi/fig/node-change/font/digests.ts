import type { SceneGraph } from '@open-pencil/scene-graph'

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

/** Every `family|style` the document's text uses, read synchronously. */
function documentFontKeys(graph: SceneGraph): Set<string> {
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
  return fontKeys
}

export async function buildFontDigestMap(graph: SceneGraph): Promise<Map<string, Uint8Array>> {
  const result = new Map<string, Uint8Array>()
  await addFontDigests(result, documentFontKeys(graph))
  return result
}

async function addFontDigests(
  digests: Map<string, Uint8Array>,
  keys: Iterable<string>
): Promise<void> {
  for (const key of keys) {
    const [family, style] = key.split('|')
    const digest = await getFontDigest(family, style)
    if (digest) digests.set(key, digest)
  }
}

/**
 * Digests for every font the document uses, read again after each wait: an edit made while
 * digests load can bring a new font in. Resolves only when a synchronous check finds none
 * missing, so a caller that continues without awaiting writes records that every digest covers.
 * Each round looks up only fonts it has not seen, and a font with no digest is looked up once, so
 * it ends once edits stop bringing in new fonts.
 */
export async function settleFontDigestMap(graph: SceneGraph): Promise<Map<string, Uint8Array>> {
  const digests = new Map<string, Uint8Array>()
  const looked = new Set<string>()
  for (;;) {
    const missing = [...documentFontKeys(graph)].filter((key) => !looked.has(key))
    if (missing.length === 0) return digests
    for (const key of missing) looked.add(key)
    await addFontDigests(digests, missing)
  }
}
