import { fromUint8Array } from 'js-base64'

import { isVariableFont } from '#core/text/font/variation'

/**
 * The SVG handed to svg2pdf names fonts by family, weight, and style, while jsPDF knows only its
 * standard fonts plus the files registered with it, and only a normal and a bold face per family.
 * Every face a page uses is therefore registered under a family name of its own, and the text
 * that uses it is pointed at that name.
 */

/** The parts of an SVG element read and rewritten here; a DOM `Element` satisfies it. */
export interface SVGTextElementLike {
  parentElement: SVGTextElementLike | null
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
}

export interface SVGRootLike {
  querySelectorAll(selector: string): ArrayLike<SVGTextElementLike>
}

export interface PDFFace {
  family: string
  weight: number
  italic: boolean
}

/** Loads the font file of a face, or null when it is not available. */
export type PDFFontLoader = (face: PDFFace) => Promise<ArrayBuffer | null>

/** The jsPDF calls that register a font file. */
export interface PDFFontTarget {
  addFileToVFS(fileName: string, data: string): unknown
  addFont(fileName: string, family: string, style: string): unknown
}

export interface PDFFontReport {
  /** Faces embedded in the file, such as `Inter 700 italic`. */
  embedded: string[]
  /** Faces drawn in a standard PDF font instead, with the reason. */
  fallback: Array<{ face: string; reason: string }>
}

export const faceLabel = (face: PDFFace): string =>
  `${face.family} ${face.weight}${face.italic ? ' italic' : ''}`

const faceKey = (face: PDFFace): string => `${face.family}|${face.weight}|${face.italic}`

function parseFontWeight(value: string | null): number {
  if (value === 'bold') return 700
  const weight = Number(value)
  return Number.isFinite(weight) && weight >= 1 && weight <= 1000 ? Math.round(weight) : 400
}

function inheritedAttribute(element: SVGTextElementLike, name: string): string | null {
  for (let current: SVGTextElementLike | null = element; current; current = current.parentElement) {
    const value = current.getAttribute(name)
    if (value) return value
  }
  return null
}

/** The face a `text` or `tspan` element is drawn in, from its own attributes or its ancestors'. */
function faceOf(element: SVGTextElementLike): PDFFace | null {
  const family = inheritedAttribute(element, 'font-family')
    ?.split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '')
  if (!family) return null
  const style = inheritedAttribute(element, 'font-style')
  return {
    family,
    weight: parseFontWeight(inheritedAttribute(element, 'font-weight')),
    italic: style === 'italic' || style === 'oblique'
  }
}

function textFaces(roots: readonly SVGRootLike[]): Array<[SVGTextElementLike, PDFFace]> {
  const faces: Array<[SVGTextElementLike, PDFFace]> = []
  for (const root of roots) {
    for (const element of Array.from(root.querySelectorAll('text, tspan'))) {
      const face = faceOf(element)
      if (face) faces.push([element, face])
    }
  }
  return faces
}

/** Why a font file cannot be embedded, or null when jsPDF can embed it. */
function unsupportedReason(data: ArrayBuffer): string | null {
  const tag = data.byteLength >= 12 ? new DataView(data).getUint32(0) : 0
  // TrueType outlines: version 1.0 or Apple's 'true'. CFF ('OTTO'), WOFF, and collections are not.
  if (tag !== 0x00010000 && tag !== 0x74727565) return 'not a TrueType font file'
  // jsPDF would draw every weight of a variable font in its default instance.
  if (isVariableFont(data)) return 'variable font'
  return null
}

async function loadFace(face: PDFFace, load: PDFFontLoader): Promise<ArrayBuffer | string> {
  try {
    const data = await load(face)
    if (!data) return 'font file not available'
    return unsupportedReason(data) ?? data
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

/**
 * Registers the font file of every face the SVG roots' text uses and points that text at it.
 * Text in a face that cannot be embedded keeps its family, weight, and style, so jsPDF draws it
 * in a standard font; the report says which faces were embedded and why the others were not.
 */
export async function embedFonts(
  doc: PDFFontTarget,
  roots: readonly SVGRootLike[],
  load: PDFFontLoader
): Promise<PDFFontReport> {
  const report: PDFFontReport = { embedded: [], fallback: [] }
  const used = textFaces(roots)
  const aliases = new Map<string, string | null>()
  for (const [, face] of used) {
    const key = faceKey(face)
    if (aliases.has(key)) continue
    const loaded = await loadFace(face, load)
    let alias: string | null = null
    if (typeof loaded === 'string') {
      report.fallback.push({ face: faceLabel(face), reason: loaded })
    } else {
      // jsPDF reads family names as CSS: letters and digits only keep them unambiguous.
      alias = `EmbeddedFont${aliases.size}`
      try {
        doc.addFileToVFS(`${alias}.ttf`, fromUint8Array(new Uint8Array(loaded)))
        doc.addFont(`${alias}.ttf`, alias, 'normal')
        report.embedded.push(faceLabel(face))
      } catch (error) {
        alias = null
        const reason = error instanceof Error ? error.message : String(error)
        report.fallback.push({ face: faceLabel(face), reason })
      }
    }
    aliases.set(key, alias)
  }
  // Faces are read before any element changes: a rewritten parent would change what its
  // children inherit. Each element then names its face itself.
  for (const [element, face] of used) {
    const alias = aliases.get(faceKey(face))
    element.setAttribute('font-family', alias ?? face.family)
    element.setAttribute('font-weight', alias ? 'normal' : String(face.weight))
    element.setAttribute('font-style', alias || !face.italic ? 'normal' : 'italic')
  }
  return report
}
