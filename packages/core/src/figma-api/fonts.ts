import { uniq, uniqBy } from 'es-toolkit/array'

import type { FontVariation } from '@open-pencil/scene-graph'
import type { FontFamilyStyle } from '@open-pencil/scene-graph/font-style'
import {
  FONT_WEIGHT_NAMES,
  parseFontStyle,
  weightToStyle
} from '@open-pencil/scene-graph/font-style'

import {
  namedInstanceVariations,
  type FontAxis,
  type NamedInstance
} from '#core/text/font/variation'
import { fontManager } from '#core/text/fonts'

/** A font as Figma reads one; a variable font's also lists every axis it is drawn at. */
export type FigmaFontName = FontFamilyStyle & { variationSettings?: FigmaVariationSettings }
export type FigmaFont = { fontName: FigmaFontName }

export function weightToStyleName(weight: number, italic: boolean): string {
  const base = FONT_WEIGHT_NAMES[weight] ?? 'Regular'
  return italic ? `${base} Italic` : base
}

/**
 * The style name text asks the font manager for, whichever way a script spells it ("Italic",
 * "Semi Bold"), so a font a script loaded is the one its text edits find loaded.
 */
function textFaceStyle(style: string): string {
  const { weight, italic } = parseFontStyle(style)
  return weightToStyle(weight, italic)
}

/** Figma's rejection for a font it cannot load. */
function fontLoadError(family: string, style: string): Error {
  return new Error(`The font "${family} ${style}" could not be loaded`)
}

/**
 * Loads a font as Figma's `loadFontAsync` does, so text measures and draws with it from then on,
 * and rejects when it cannot load. A family named alone loads every style it has: one style of
 * each slant first, so the rest reuse its file where one variable file draws the whole slant, and
 * then the named styles a variable file draws, which text set by its axes alone takes.
 */
export async function loadFigmaFont({ family, style }: FigmaFontNameInput): Promise<void> {
  if (style !== undefined) {
    const face = textFaceStyle(style)
    await fontManager.loadFont(family, face).catch(() => null)
    if (!fontManager.isStyleLoaded(family, face)) throw fontLoadError(family, style)
    return
  }
  const faces = (await fontManager.familyFaces(family).catch(() => null)) ?? [
    { weight: 400, italic: false }
  ]
  const load = (face: string) => fontManager.loadFont(family, face).catch(() => null)
  const first = uniqBy(faces, (face) => face.italic)
  await Promise.all(first.map((face) => load(weightToStyle(face.weight, face.italic))))
  await Promise.all(
    faces
      .filter((face) => !first.includes(face))
      .map((face) => load(weightToStyle(face.weight, face.italic)))
  )
  if (!fontManager.isLoaded(family)) throw fontLoadError(family, 'Regular')
  const named = [false, true].flatMap((italic) =>
    (fontManager.familyVariation(family, italic)?.instances ?? []).map((instance) =>
      weightToStyle(parseFontStyle(instance.name).weight, italic)
    )
  )
  await Promise.all(uniq(named).map(load))
}

/** Variable font axis values by axis tag, as `FontName.variationSettings` holds them. */
export type FigmaVariationSettings = Record<string, number>

/** A font to apply, as Figma takes one: `style` may be left out for the axes to pick it. */
export interface FigmaFontNameInput {
  family: string
  style?: string
  variationSettings?: FigmaVariationSettings
}

/** Figma lists axis tags in code unit order, so `GRAD` comes before `opsz`. */
function byCodeUnit(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/** The axis tags a family accepts, as `getFontFamilyVariationAxes` lists them. */
export function variationAxisTags(axes: readonly FontAxis[]): string[] {
  return axes.map((axis) => axis.tag).sort(byCodeUnit)
}

/**
 * Figma's `variationSettings` for text in `style` of a variable family: every axis, at the named
 * instance's value unless the text sets it. An optical size that follows the font size reads as
 * the instance's own, as Figma reads it. Nothing for a static family or one not loaded.
 */
export function readVariationSettings(
  family: string,
  style: string,
  variations: readonly FontVariation[],
  opticalSizeFromFontSize: boolean
): FigmaVariationSettings | undefined {
  const variation = fontManager.familyVariation(family, parseFontStyle(style).italic)
  if (!variation) return undefined
  const named = namedInstanceVariations(variation.data, style) ?? []
  const set = opticalSizeFromFontSize
    ? variations.filter((entry) => entry.axis !== 'opsz')
    : variations
  const values = new Map(variation.axes.map((axis) => [axis.tag, axis.default]))
  for (const { axis, value } of [...named, ...set]) if (values.has(axis)) values.set(axis, value)
  return Object.fromEntries([...values].sort(([a], [b]) => byCodeUnit(a, b)))
}

/** Where `value` sits on an axis, from -1 at its minimum through 0 at its default to 1. */
function normalized(axis: FontAxis, value: number): number {
  if (value < axis.default) return (value - axis.default) / (axis.default - axis.min || 1)
  return (value - axis.default) / (axis.max - axis.default || 1)
}

/** How much two distances may differ in floating point and still be as near. */
const DISTANCE_TOLERANCE = 1e-9

/** The named instance nearest `target` on the font's axes; the later one where two are as near. */
function nearestInstance(
  axes: readonly FontAxis[],
  instances: readonly NamedInstance[],
  target: Partial<FigmaVariationSettings>
): string | undefined {
  let nearest: { name: string; distance: number } | undefined
  for (const instance of instances) {
    const distance = instance.variations.reduce((sum, { axis, value }) => {
      const found = axes.find((entry) => entry.tag === axis)
      const wanted = target[axis]
      if (!found || wanted === undefined) return sum
      return sum + (normalized(found, wanted) - normalized(found, value)) ** 2
    }, 0)
    if (!nearest || distance <= nearest.distance + DISTANCE_TOLERANCE) {
      nearest = { name: instance.name, distance }
    }
  }
  return nearest?.name
}

/**
 * What applying `input` sets on the text: its family and style, and the axes it sets over the
 * style's named instance. A style left out is the named instance nearest the axes, the ones the
 * input leaves out read from `current`; with no axes either, the current style stays. Axes the
 * family does not have throw, as Figma rejects them.
 */
/** The family's axes in the slant asked for, once each of `tags` is checked among them. */
function checkedVariation(method: string, family: string, slanted: boolean, tags: string[]) {
  const variation = fontManager.familyVariation(family, slanted)
  if (tags.length > 0 && variation === undefined) {
    throw new Error(
      `in ${method}: Font family "${family}" is not loaded, so its variation axes are unknown. Call loadFontAsync first.`
    )
  }
  if (tags.length > 0 && variation === null) {
    throw new Error(
      `in ${method}: "${tags[0]}" is not a valid variation setting. Font "${family}" has no variation axes.`
    )
  }
  if (variation) {
    const valid = variationAxisTags(variation.axes)
    const invalid = tags.find((tag) => !valid.includes(tag))
    if (invalid) {
      throw new Error(
        `in ${method}: "${invalid}" is not a valid variation setting. Valid settings are ${JSON.stringify(valid)}.`
      )
    }
  }
  return variation
}

/** The font a character has before a new one is set over it. */
export interface CurrentFont {
  style: string
  /** The axes the text sets itself, over its style's. */
  fontVariations: readonly FontVariation[]
  variationSettings?: FigmaVariationSettings
}

export function fontNameInputStyle(
  method: string,
  input: FigmaFontNameInput,
  current?: CurrentFont
): { fontFamily: string; fontWeight: number; italic: boolean; fontVariations: FontVariation[] } {
  const settings = input.variationSettings ?? {}
  const tags = Object.keys(settings)
  const slanted = parseFontStyle(input.style ?? current?.style ?? 'Regular').italic
  const variation = checkedVariation(method, input.family, slanted, tags)
  const style =
    input.style ??
    (tags.length > 0 && variation
      ? nearestInstance(variation.axes, variation.instances, {
          ...current?.variationSettings,
          ...settings
        })
      : undefined) ??
    current?.style ??
    'Regular'
  const { weight, italic } = parseFontStyle(style)
  return {
    fontFamily: input.family,
    fontWeight: weight,
    // A style picked from the axes keeps the text's slant, whichever file the axes came from.
    italic: input.style ? italic : slanted,
    // A style resets the axes to its own; without one, the axes the text set stay.
    fontVariations: [
      ...(input.style ? [] : (current?.fontVariations ?? [])).filter(
        ({ axis }) => !tags.includes(axis)
      ),
      ...tags.map((axis) => ({ axis, value: settings[axis] ?? 0 }))
    ]
  }
}
