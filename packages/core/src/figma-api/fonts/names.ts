import type { FontVariation } from '@open-pencil/scene-graph'
import type { FontFamilyStyle } from '@open-pencil/scene-graph/font-style'
import { parseFontStyle } from '@open-pencil/scene-graph/font-style'

import {
  checkedVariation,
  nearestInstance,
  type FigmaVariationSettings
} from '#core/figma-api/fonts/variations'
import { faceForStyle } from '#core/text/font/names'

/** A font as Figma reads one; a variable font's also lists every axis it is drawn at. */
export type FigmaFontName = FontFamilyStyle & { variationSettings?: FigmaVariationSettings }
export type FigmaFont = { fontName: FigmaFontName }

/** A font to apply, as Figma takes one: `style` may be left out for the axes to pick it. */
export interface FigmaFontNameInput {
  family: string
  style?: string
  variationSettings?: FigmaVariationSettings
}

/** The font a character has before a new one is set over it. */
export interface CurrentFont {
  style: string
  /** The axes the text sets itself, over its style's. */
  fontVariations: readonly FontVariation[]
  variationSettings?: FigmaVariationSettings
}

/**
 * What applying `input` sets on the text: its family and style, and the axes it sets over the
 * style's named instance. A style left out is the named instance nearest the axes, the ones the
 * input leaves out read from `current`; with no axes either, the current style stays. Axes the
 * family does not have throw, as Figma rejects them.
 */
export function fontNameInputStyle(
  method: string,
  input: FigmaFontNameInput,
  current?: CurrentFont
) {
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
  const face = faceForStyle(input.family, style)
  return {
    fontFamily: input.family,
    fontWeight: face.weight,
    // A style picked from the axes keeps the text's slant, whichever file the axes came from.
    italic: input.style ? face.italic : slanted,
    // An instance of the other slant names no face of this one; the family's own name does.
    fontStyle: input.style !== undefined || face.italic === slanted ? face.style : null,
    // A style resets the axes to its own; without one, the axes the text set stay.
    fontVariations: [
      ...(input.style ? [] : (current?.fontVariations ?? [])).filter(
        ({ axis }) => !tags.includes(axis)
      ),
      ...tags.map((axis) => ({ axis, value: settings[axis] ?? 0 }))
    ]
  }
}
