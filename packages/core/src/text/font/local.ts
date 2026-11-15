import { compact } from 'es-toolkit'

import {
  namesWeight,
  namesWidth,
  normalizeFontFamily,
  parseFontStyle,
  styleSpelling
} from '@open-pencil/scene-graph/font-style'

import { IS_BROWSER } from '#core/constants'
import type { FamilyFace } from '#core/text/font/faces'
import { SharedReads } from '#core/text/font/reads'
import type { FontInfo, LocalFontAccessState } from '#core/text/font/sources'
import { listedLocalFont } from '#core/text/font/style'
import {
  fontAxes,
  fontFaceName,
  namedInstances,
  statNamer,
  type NamedInstance
} from '#core/text/font/variation'

/** The fonts installed in the browser's system, read through the Local Font Access API. */
export class LocalFonts {
  private fonts: FontInfo[] | null = null
  private state: LocalFontAccessState = IS_BROWSER ? 'prompt' : 'unsupported'
  private readonly requests = new SharedReads()
  private readonly ownNames = new OwnFaceNames()

  accessState(): LocalFontAccessState {
    return this.state
  }

  /** The installed fonts, once access was asked for; `null` before. */
  list(): FontInfo[] | null {
    return this.fonts
  }

  /** Asks for access and lists the installed fonts, one entry per family and style. */
  async requestAccess(): Promise<FontInfo[]> {
    if (!IS_BROWSER || !window.queryLocalFonts) {
      this.state = 'unsupported'
      this.fonts = []
      return []
    }
    try {
      const fonts = await window.queryLocalFonts()
      const seen = new Set<string>()
      const result: FontInfo[] = []
      for (const f of fonts) {
        const key = `${f.family}|${f.style}`
        if (seen.has(key)) continue
        seen.add(key)
        result.push({
          family: f.family,
          fullName: f.fullName,
          style: f.style,
          postscriptName: f.postscriptName
        })
      }
      this.fonts = result
      this.state = 'granted'
      return result
    } catch {
      this.fonts = []
      this.state = 'denied'
      return []
    }
  }

  /**
   * The family and style the font of a face read for `family` and `style` names it with, as
   * Figma names it: Windows lists Segoe UI Variable's "Bold Display" as "Segoe UI Variable
   * Display" / "Display Bold". `undefined` until that face is read.
   */
  ownFace(family: string, style: string): OwnFace | undefined {
    return this.ownNames.ownFace(family, style)
  }

  /** The families the fonts read so far name themselves, where they are listed under others. */
  ownFamilies(): string[] {
    return this.ownNames.families()
  }

  /** The faces of a family the fonts read so far name themselves; `null` for none. */
  ownFamilyFaces(family: string): FamilyFace[] | null {
    return this.ownNames.familyFaces(family)
  }

  /** Calls the listener whenever a font read names a family or face not known before. */
  onOwnFamiliesChanged(listener: () => void): () => void {
    return this.ownNames.onChange(listener)
  }

  /**
   * Lists the installed fonts again, once access is granted, as after a font was installed
   * meanwhile; whether the list changed. Listing reads no font files.
   */
  async refresh(): Promise<boolean> {
    if (this.state !== 'granted') return false
    const listed = (fonts: readonly FontInfo[] | null) =>
      (fonts ?? []).map((font) => `${font.family}|${font.style}`).join('\n')
    const before = listed(this.fonts)
    return listed(await this.requestAccess()) !== before
  }

  /** A face's bytes, once access is granted. */
  read(family: string, style?: string): Promise<ArrayBuffer | null> {
    if (!IS_BROWSER || !window.queryLocalFonts) return Promise.resolve(null)
    if (this.state !== 'granted') return Promise.resolve(null)
    // A query answers with a new blob, and so new bytes, every time; the face decides the match.
    return this.requests.read(`${family}|${style ?? ''}`, () => this.query(family, style))
  }

  private async query(family: string, style?: string): Promise<ArrayBuffer | null> {
    try {
      const fonts = await window.queryLocalFonts?.()
      if (!fonts) return null
      return await readLocalFace(fonts, family, style, this.ownNames)
    } catch (e) {
      console.warn(`Local font access failed for "${family}" ${style ?? ''}:`, e)
      return null
    }
  }
}

async function fontBytes(font: FontData): Promise<ArrayBuffer> {
  return (await font.blob()).arrayBuffer()
}

/**
 * The bytes of the local face for a family and style: the face listed under the family, else
 * the face whose font names itself that family and style, else the face listed under the name
 * the family normalizes to ("Inter Variable" → "Inter"). The font's own names come before the
 * normalized name, since "Segoe UI Variable" is a family of its own, not Segoe UI.
 */
export async function readLocalFace(
  fonts: FontData[],
  family: string,
  style?: string,
  ownNames = new OwnFaceNames()
): Promise<ArrayBuffer | null> {
  const read = async (font: FontData) => {
    const data = await fontBytes(font)
    ownNames.learn(font, data, { family, style, listed: true })
    return data
  }
  const listed = listedLocalFont(fonts, family, style)
  if (listed) return read(listed)
  const named = style ? await ownNames.find(fonts, family, style) : null
  if (named) return named
  const normalized = normalizeFontFamily(family)
  const fallback = normalized === family ? undefined : listedLocalFont(fonts, normalized, style)
  return fallback ? read(fallback) : null
}

/** The family and style a face was read for, and whether a listed face had those names. */
interface LocalFaceRequest {
  family: string
  style?: string
  listed: boolean
}

/** A face by the family and style its own font names it with. */
export interface OwnFace {
  family: string
  style: string
}

function faceKey(family: string, style: string): string {
  return `${styleSpelling(family)}|${styleSpelling(style)}`
}

/**
 * The named instance a variable font's listed face stands for: the one of its name, else the
 * one whose STAT name it is, as Windows names instances ("Display Bold" for "Bold Display").
 */
function listedInstance(data: ArrayBuffer, style: string): NamedInstance | undefined {
  const instances = namedInstances(data)
  const wanted = styleSpelling(style)
  const named = instances.find((instance) => styleSpelling(instance.name) === wanted)
  if (named) return named
  const statName = statNamer(data)
  return statName
    ? instances.find((instance) => styleSpelling(statName(instance.variations)) === wanted)
    : undefined
}

/** The faces a font file names, by its own names: a variable font's instances, else its style. */
function ownFaces(data: ArrayBuffer, style: string): FamilyFace[] {
  const italic = parseFontStyle(style).italic
  const instances = namedInstances(data)
  if (instances.length === 0) return [{ ...parseFontStyle(style), style }]
  return instances.map((instance) => {
    const parsed = parseFontStyle(instance.name)
    return {
      style: instance.name,
      weight: instance.variations.find(({ axis }) => axis === 'wght')?.value ?? parsed.weight,
      italic: italic || parsed.italic
    }
  })
}

/** The names a face's font gives itself, read from its name and fvar tables. */
interface FaceNames {
  family: string
  style: string
  /** A variable font's named instances, each spelled as `styleSpelling` spells it. */
  instances: string[]
  /** The range of a variable font's weight axis, if it has one. */
  weights: { min: number; max: number } | null
}

/**
 * Finds a face by the names its own font gives it, for a face the platform lists under other
 * names. Windows groups families by weight, width, and slant alone, so it lists Segoe UI
 * Variable's optical sizes as families of their own ("Segoe UI Variable Display"), with styles
 * in another order ("Display Bold" for the font's "Bold Display"), and Sitka's as "Sitka Banner"
 * and the rest, while the font, and Figma, name the family "Segoe UI Variable" and "Sitka".
 * Each listed face's names are read once.
 */
export class OwnFaceNames {
  private readonly names = new Map<string, FaceNames | null>()
  private readonly ownFaces = new Map<string, OwnFace>()
  private readonly ownFamilies = new Map<string, { family: string; faces: FamilyFace[] }>()
  private readonly listeners = new Set<() => void>()

  /**
   * Records what the font of a face read for a request names the face and its family's faces,
   * where it names a family other than the one it is listed under. The request takes the
   * listed face's names when the face was found by its listed names (`listed`), else only a
   * named instance of the request's own name: a face found by its weight axis is not it.
   */
  learn(font: FontData, data: ArrayBuffer, request: LocalFaceRequest): void {
    const own = fontFaceName(data)
    if (!own || styleSpelling(own.family) === styleSpelling(font.family)) return
    const face = { family: own.family, style: listedInstance(data, font.style)?.name ?? own.style }
    this.ownFaces.set(faceKey(font.family, font.style), face)
    const { family, style } = request
    // A face asked for by the font's own family already has its names.
    if (style !== undefined && styleSpelling(family) !== styleSpelling(own.family)) {
      const named = listedInstance(data, style)?.name
      if (named) this.ownFaces.set(faceKey(family, style), { family: own.family, style: named })
      else if (request.listed) this.ownFaces.set(faceKey(family, style), face)
    }

    const known = this.ownFamilies.get(styleSpelling(own.family)) ?? {
      family: own.family,
      faces: []
    }
    const added = ownFaces(data, own.style).filter(
      (candidate) =>
        !known.faces.some(
          (face) =>
            styleSpelling(face.style) === styleSpelling(candidate.style) &&
            face.italic === candidate.italic
        )
    )
    if (added.length === 0) return
    for (const face of added) known.faces.push(face)
    this.ownFamilies.set(styleSpelling(own.family), known)
    for (const listener of this.listeners) listener()
  }

  ownFace(family: string, style: string): OwnFace | undefined {
    return this.ownFaces.get(faceKey(family, style))
  }

  families(): string[] {
    return [...this.ownFamilies.values()].map((known) => known.family)
  }

  familyFaces(family: string): FamilyFace[] | null {
    const known = this.ownFamilies.get(styleSpelling(family))
    return known ? [...known.faces] : null
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async find(fonts: FontData[], family: string, style: string): Promise<ArrayBuffer | null> {
    for (const font of candidatesFor(fonts, family, style)) {
      const known = this.names.get(font.postscriptName)
      if (known === null || (known && !namesFace(known, font, family, style))) continue
      const data = await fontBytes(font)
      const names = known ?? this.remember(font, data)
      if (names && namesFace(names, font, family, style)) {
        this.learn(font, data, { family, style, listed: false })
        return data
      }
    }
    return null
  }

  private remember(font: FontData, data: ArrayBuffer): FaceNames | null {
    const own = fontFaceName(data)
    const weight = fontAxes(data)?.find((axis) => axis.tag === 'wght')
    const names = own && {
      ...own,
      instances: namedInstances(data).map((instance) => styleSpelling(instance.name)),
      weights: weight ? { min: weight.min, max: weight.max } : null
    }
    this.names.set(font.postscriptName, names)
    return names
  }
}

/**
 * The faces that may be the family's: those listed under it or under a longer name that starts
 * with it, as Windows extends a family's name with the names of its optical sizes. A face whose
 * full name holds the family's and style's words goes first, only so fewer files are read; the
 * font's own names decide the match.
 */
function candidatesFor(fonts: FontData[], family: string, style: string): FontData[] {
  const wanted = styleSpelling(family)
  const words = nameWords(`${family} ${style}`)
  return fonts
    .filter((font) => styleSpelling(font.family).startsWith(wanted))
    .toSorted(
      (a, b) => Number(nameWords(b.fullName) === words) - Number(nameWords(a.fullName) === words)
    )
}

function nameWords(name: string): string {
  return compact(name.toLowerCase().split(/\s+/u)).toSorted().join(' ')
}

/**
 * Whether the face is `style` of the family: listed under the family, or its font names itself
 * that family; and its font names the face so, by its own style or a named instance, or, for a
 * style that only names a weight, draws that weight in that slant.
 */
function namesFace(names: FaceNames, font: FontData, family: string, style: string): boolean {
  const wanted = styleSpelling(family)
  if (styleSpelling(font.family) !== wanted && styleSpelling(names.family) !== wanted) return false
  const spelled = styleSpelling(style)
  if (styleSpelling(names.style) === spelled || names.instances.includes(spelled)) return true
  if (!namesWeight(style)) return false
  const requested = parseFontStyle(style)
  const own = parseFontStyle(names.style)
  if (own.italic !== requested.italic) return false
  if (names.weights) {
    return requested.weight >= names.weights.min && requested.weight <= names.weights.max
  }
  return own.weight === requested.weight && !namesWidth(names.style)
}
