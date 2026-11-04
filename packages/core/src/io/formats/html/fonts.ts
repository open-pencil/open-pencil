import { uniqBy } from 'es-toolkit'

import type { DesignDocument, DesignElement } from '@open-pencil/dom-css'
import type { HTMLEngine, HTMLEngineFontFace } from '@open-pencil/html-engine'
import type { SceneGraph } from '@open-pencil/scene-graph'
import {
  CSS_GENERIC_FONT_FAMILIES,
  cssFontFamilyName,
  parseCSSFontFamilies
} from '@open-pencil/scene-graph/css'

import { DEFAULT_FONT_FAMILY } from '#core/constants'
import { fontManager } from '#core/text/font/manager'
import { faceStyleName } from '#core/text/font/names'
import { collectGraphFontRequirements, collectNodeFontFaces } from '#core/text/requirements/collect'

interface EngineFonts {
  /** `family|style` of every face looked for, found or not. */
  faces: Set<string>
  /** `family|style` of the faces registered with the default family's face standing in. */
  standIns: Set<string>
  /** The files registered for each family, which aliases of it reuse. */
  files: Map<string, Uint8Array[]>
  /** `name|index` of every file registered under a name the engine does not know as generic. */
  aliases: Set<string>
}

const engineFonts = new WeakMap<HTMLEngine, EngineFonts>()

function fontsOf(engine: HTMLEngine): EngineFonts {
  const known = engineFonts.get(engine)
  if (known) return known
  const fonts: EngineFonts = {
    faces: new Set(),
    standIns: new Set(),
    files: new Map(),
    aliases: new Set()
  }
  engineFonts.set(engine, fonts)
  return fonts
}

/**
 * The face text in `family` and `style` draws with: the family's own, or, when the font manager
 * finds it nowhere, the default family's, as a layer draws a missing font.
 */
async function drawnFace(family: string, style: string, characters: string) {
  const own = await fontManager.loadFont(family, style, characters)
  if (own) return { face: own, standIn: false }
  const standIn =
    (await fontManager.loadFont(DEFAULT_FONT_FAMILY, style, characters)) ??
    (await fontManager.loadFont(DEFAULT_FONT_FAMILY, 'Regular', characters))
  return standIn ? { face: standIn, standIn: true } : null
}

function faceKey({ family, style }: { family: string; style: string }): string {
  return `${family}|${style}`
}

function faceOfKey(key: string): { family: string; style: string } {
  const at = key.lastIndexOf('|')
  return { family: key.slice(0, at), style: key.slice(at + 1) }
}

/**
 * Whether a face registered with a stand-in now has its own font, which the layers draw with.
 * The engine cannot drop one face, so its fonts are then registered again from the start.
 */
async function standInResolved(fonts: EngineFonts, characters: string): Promise<boolean> {
  for (const key of fonts.standIns) {
    const { family, style } = faceOfKey(key)
    if (await fontManager.loadFont(family, style, characters)) return true
  }
  return false
}

/**
 * Points CSS's generic families, such as `system-ui`, at the real families the importer sets their
 * text in. A name the engine does not take as generic, such as `-apple-system`, gets the family's
 * files registered under it instead.
 */
function mapGenericFamilies(engine: HTMLEngine, fonts: EngineFonts): void {
  for (const [name, family] of Object.entries(CSS_GENERIC_FONT_FAMILIES)) {
    const files = fonts.files.get(family) ?? []
    if (files.length === 0 || engine.setGenericFamily(name, [family])) continue
    for (const [index, file] of files.entries()) {
      if (fonts.aliases.has(`${name}|${index}`)) continue
      engine.addFont(file, name)
      fonts.aliases.add(`${name}|${index}`)
    }
  }
}

/**
 * Registers in the engine the faces the text layers of `graph` use, loaded through the font
 * manager, so the engine breaks lines in the fonts the layers draw with. Each face is registered
 * under the family its layers name, which also covers a face the font manager stood in for.
 * Returns whether the engine got a face it did not have, so a layout made before needs redoing.
 */
export async function registerLayerFonts(engine: HTMLEngine, graph: SceneGraph): Promise<boolean> {
  const pageIds = graph.getPages().map((page) => page.id)
  const { nodes, characters } = collectGraphFontRequirements(graph, pageIds)
  let fonts = fontsOf(engine)
  const wanted = uniqBy(nodes.flatMap(collectNodeFontFaces), faceKey)
  let reset = false
  if (await standInResolved(fonts, characters)) {
    // Every face looked for so far, so earlier documents keep laying out in theirs.
    wanted.push(...[...fonts.faces].map(faceOfKey))
    engine.resetFonts()
    engineFonts.delete(engine)
    fonts = fontsOf(engine)
    reset = true
  }
  let added = false
  for (const face of uniqBy(wanted, faceKey).filter((face) => !fonts.faces.has(faceKey(face)))) {
    fonts.faces.add(faceKey(face))
    const drawn = await drawnFace(face.family, face.style, characters)
    if (!drawn) continue
    if (drawn.standIn) fonts.standIns.add(faceKey(face))
    const file = new Uint8Array(drawn.face)
    engine.addFont(file, face.family)
    fonts.files.set(face.family, [...(fonts.files.get(face.family) ?? []), file])
    added = true
  }
  if (added) mapGenericFamilies(engine, fonts)
  return added || reset
}

function styledElements(styled: DesignDocument): DesignElement[] {
  const elements: DesignElement[] = []
  const walk = (nodes: DesignDocument['children']) => {
    for (const node of nodes) {
      if (node.type !== 'element') continue
      elements.push(node)
      walk(node.children)
    }
  }
  walk(styled.children)
  return elements
}

function textOf(styled: DesignDocument): string {
  const parts: string[] = []
  const walk = (nodes: DesignDocument['children']) => {
    for (const node of nodes) {
      if (node.type === 'text') parts.push(node.text)
      else walk(node.children)
    }
  }
  walk(styled.children)
  return parts.join('')
}

/**
 * The family a `font-family` list sets text in, as a browser picks it: the first one there is a
 * font for, with generic families mapped to the real ones the importer uses, and the default
 * family when none has one. Text then names a font that loads, which the engine lays out in.
 */
async function availableFamily(
  { list, weight, italic }: RequestedFace,
  characters: string,
  available: Map<string, Promise<boolean>>,
  pageFamilies: PageFontFamilies
): Promise<string> {
  for (const candidate of parseCSSFontFamilies(list)) {
    const family = cssFontFamilyName(candidate)
    // CSS matches family names without regard to ASCII case.
    const declared = pageFamilies.get(family.toLowerCase())
    if (declared) return declared
    const style = faceStyleName(family, weight, italic)
    let found = available.get(`${family}|${style}`)
    if (!found) {
      found = fontManager.loadFont(family, style, characters).then((face) => face !== null)
      available.set(`${family}|${style}`, found)
    }
    if (await found) return family
  }
  return DEFAULT_FONT_FAMILY
}

/** A text's `font-family` list and the face it asks for from it. */
interface RequestedFace {
  list: string
  weight: number
  italic: boolean
}

/** The families a page's `@font-face` rules declare, by their lowercase names. */
export type PageFontFamilies = ReadonlyMap<string, string>

function requestedFace(style: Record<string, string>, list: string): RequestedFace {
  const weight = Number.parseFloat(style['font-weight'] ?? '')
  return {
    list,
    weight: Number.isFinite(weight) ? weight : 400,
    italic: /italic|oblique/i.test(style['font-style'] ?? '')
  }
}

/** A family name as a quoted CSS string. */
function quotedFamily(family: string): string {
  return `"${family.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

/**
 * Sets each element's computed `font-family` to the one family its text is set in, as
 * `availableFamily` picks it, so the layers built from the document name fonts that load.
 */
export async function resolvePageFontFamilies(
  styled: DesignDocument,
  pageFamilies: PageFontFamilies = new Map()
): Promise<void> {
  const elements = styledElements(styled).filter(
    (element) => element.computedStyle?.['font-family'] !== undefined
  )
  const characters = textOf(styled)
  const available = new Map<string, Promise<boolean>>()
  const resolved = new Map<string, Promise<string>>()
  for (const element of elements) {
    const style = element.computedStyle
    const list = style?.['font-family']
    if (!style || list === undefined) continue
    const face = requestedFace(style, list)
    const key = `${list}|${face.weight}|${face.italic}`
    let family = resolved.get(key)
    if (!family) {
      family = availableFamily(face, characters, available, pageFamilies)
      resolved.set(key, family)
    }
    style['font-family'] = quotedFamily(await family)
  }
}

/**
 * Registers a font a page's `@font-face` rule loads with the font manager, under the family and
 * the face the rule declares, so the layers draw the page's text in the font it set it in.
 */
export async function registerPageFontFace(face: HTMLEngineFontFace): Promise<void> {
  const { buffer, byteOffset, byteLength } = face.bytes
  const data = buffer.slice(byteOffset, byteOffset + byteLength)
  if (!(data instanceof ArrayBuffer)) return
  await fontManager.markLoaded(
    face.family,
    faceStyleName(face.family, face.weight, face.italic),
    data
  )
}
