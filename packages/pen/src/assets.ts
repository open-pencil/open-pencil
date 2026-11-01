import type { PenDocument, PenNode, PenOverride, PenPaint, PenPaints } from './schema'
import { possibleValues } from './variables'

/**
 * The icon set each of pen.dev's libraries is drawn from: Iconify's for Lucide, Feather, and
 * Phosphor, which pen.dev draws at one weight, and Google's variable fonts for Material Symbols.
 */
const ICON_SETS: Partial<Record<string, string>> = {
  lucide: 'lucide',
  feather: 'feather',
  phosphor: 'ph',
  'Material Symbols Outlined': 'material-symbols-outlined',
  'Material Symbols Rounded': 'material-symbols-rounded',
  'Material Symbols Sharp': 'material-symbols-sharp'
}

/** The libraries pen.dev draws at an icon's `weight`: Material Symbols' variable fonts. */
const WEIGHTED_LIBRARIES = new Set([
  'Material Symbols Outlined',
  'Material Symbols Rounded',
  'Material Symbols Sharp'
])

/** The weight pen.dev draws Material Symbols at when an icon sets none. */
const MATERIAL_SYMBOLS_WEIGHT = 200

/** An icon's name in its set. */
export function iconName(library: string, icon: string): string | null {
  const set = ICON_SETS[library]
  return set ? `${set}:${icon}` : null
}

/** How an icon from `library` is drawn at `weight`: its font's weight axis, for Material Symbols. */
export function iconOptions(
  library: string,
  weight: number | undefined
): Record<string, number> | undefined {
  return WEIGHTED_LIBRARIES.has(library) ? { wght: weight ?? MATERIAL_SYMBOLS_WEIGHT } : undefined
}

/** An icon a document draws: its name in its set and how it is drawn there. */
export interface PenIconRequest {
  name: string
  options?: Record<string, number>
}

/**
 * Whether an image URL names a file in the document's folder: no scheme, no absolute path, and no
 * `..` step out of it.
 */
export function isDocumentAssetPath(url: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('/') || url.startsWith('\\')) return false
  return !url.split(/[/\\]/).includes('..')
}

/** Whether an image URL carries the image itself, for the host to decode as a URL. */
export function isDataURL(url: string): boolean {
  return /^data:/i.test(url)
}

/** What a document draws from outside itself. */
export interface PenAssets {
  /** Every icon, each way it is drawn. */
  icons: PenIconRequest[]
  /** Images to load: files relative to the document, and data URLs. */
  images: string[]
}

function paintList(paints: PenPaints | undefined): PenPaint[] {
  if (paints === undefined) return []
  return Array.isArray(paints) ? paints : [paints]
}

function paintImages(paints: PenPaints | undefined, images: Set<string>) {
  for (const paint of paintList(paints)) {
    if (typeof paint === 'object' && paint.type === 'image' && typeof paint.url === 'string') {
      if (isDocumentAssetPath(paint.url) || isDataURL(paint.url)) images.add(paint.url)
    }
  }
}

/** Paints with each image file they name renamed by `rebase`; data URLs and others as they are. */
function rebasePaints<T extends PenPaints>(paints: T, rebase: (url: string) => string): T {
  const one = (paint: PenPaint): PenPaint =>
    typeof paint === 'object' &&
    paint.type === 'image' &&
    typeof paint.url === 'string' &&
    isDocumentAssetPath(paint.url)
      ? { ...paint, url: rebase(paint.url) }
      : paint
  return (Array.isArray(paints) ? paints.map(one) : one(paints)) as T
}

function rebaseNode<T extends PenOverride>(node: T, rebase: (url: string) => string): T {
  const rebased: T = { ...node }
  if (node.fill !== undefined) rebased.fill = rebasePaints(node.fill, rebase)
  if (node.stroke !== undefined && !(typeof node.stroke === 'object' && 'thickness' in node.stroke)) {
    rebased.stroke = rebasePaints(node.stroke, rebase)
  }
  if (node.children) rebased.children = node.children.map((child) => rebaseNode(child, rebase))
  if (node.descendants) {
    rebased.descendants = Object.fromEntries(
      Object.entries(node.descendants).map(([path, override]) => [path, rebaseNode(override, rebase)])
    )
  }
  return rebased
}

/**
 * A document with each image file its layers name renamed by `rebase`, such as to the path from
 * another document that imports it, since a file is named relative to the document naming it.
 */
export function rebaseImages(doc: PenDocument, rebase: (url: string) => string): PenDocument {
  return { ...doc, children: doc.children.map((node) => rebaseNode(node, rebase)) }
}

interface Found {
  doc: PenDocument
  /** Requests by their name and options, so each is listed once. */
  icons: Map<string, PenIconRequest>
  images: Set<string>
  libraries: Set<string>
  /** Icons an override names without its library, which comes from the layer it overrides. */
  bareIcons: Set<string>
  /** The weights icons are drawn at, for icons whose library an override leaves out. */
  weights: Set<number | undefined>
}

/**
 * Every weight a field can take, through the variables it names. A value that is no number, or a
 * variable without one, leaves the weight unset, as drawing reads it.
 */
function possibleWeights(weight: PenOverride['weight'], doc: PenDocument): (number | undefined)[] {
  if (weight === undefined) return [undefined]
  if (typeof weight === 'number') return [weight]
  const values = possibleValues(weight, doc).map((value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  })
  return values.length > 0 ? values : [undefined]
}

function addIcons(
  libraries: readonly string[],
  icons: readonly string[],
  weights: readonly (number | undefined)[],
  found: Found
) {
  for (const library of libraries) {
    for (const icon of icons) {
      // A variable without a name in some theme draws no icon there.
      const name = icon ? iconName(library, icon) : null
      if (!name) continue
      for (const weight of weights) {
        const options = iconOptions(library, weight)
        found.icons.set(`${name}\0${JSON.stringify(options ?? null)}`, { name, options })
      }
    }
  }
}

function collect(node: PenOverride, assets: Found) {
  if (node.icon && (node.type === 'icon' || node.type === undefined)) {
    const icons = possibleValues(node.icon, assets.doc)
    const weights = possibleWeights(node.weight, assets.doc)
    for (const weight of weights) assets.weights.add(weight)
    if (node.library) {
      const libraries = possibleValues(node.library, assets.doc)
      for (const library of libraries) assets.libraries.add(library)
      addIcons(libraries, icons, weights, assets)
    } else {
      for (const icon of icons) assets.bareIcons.add(icon)
    }
  }
  paintImages(node.fill, assets.images)
  if (!(typeof node.stroke === 'object' && 'thickness' in node.stroke)) {
    paintImages(node.stroke, assets.images)
  }
  for (const child of node.children ?? []) collect(child, assets)
  for (const override of Object.values(node.descendants ?? {})) collect(override, assets)
}

/**
 * The icons and the image files a document draws, so a host can load them before reading it. An
 * icon, library, or weight bound to a variable counts every value the variable has.
 */
export function penAssets(doc: PenDocument): PenAssets {
  const assets: Found = {
    doc,
    icons: new Map(),
    images: new Set(),
    libraries: new Set(),
    bareIcons: new Set(),
    weights: new Set()
  }
  for (const node of doc.children) collect(node satisfies PenNode, assets)
  addIcons([...assets.libraries], [...assets.bareIcons], [...assets.weights], assets)
  return { icons: [...assets.icons.values()], images: [...assets.images] }
}
