import type { FontVariation } from '@open-pencil/scene-graph'
import { parseFontStyle } from '@open-pencil/scene-graph/font-style'

import { fontManager } from '#core/text/font/manager'
import {
  namedInstanceVariations,
  type FontAxis,
  type NamedInstance
} from '#core/text/font/variation'

/** Variable font axis values by axis tag, as `FontName.variationSettings` holds them. */
export type FigmaVariationSettings = Record<string, number>

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
export function nearestInstance(
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

/** The family's axes in the slant asked for, once each of `tags` is checked among them. */
export function checkedVariation(method: string, family: string, slanted: boolean, tags: string[]) {
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
