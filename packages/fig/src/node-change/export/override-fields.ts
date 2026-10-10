import type { EncodedOverrideField } from '#fig/instance-overrides/fields'

import type { NodeChange as KiwiNodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneNode } from '@open-pencil/scene-graph'

import {
  exportEffects,
  exportFontName,
  normalizeStackCounterAlignItems,
  normalizeStackJustify
} from './layer-fields'

/** Figma's automatic line height. */
const AUTO_LINE_HEIGHT = { value: 100, units: 'PERCENT' }

type OverrideEncoder = (node: SceneNode) => Partial<KiwiNodeChange>

/**
 * What an instance override claim writes for each raw field, in the encoding the layer's own
 * NodeChange uses. A claim states its value even when it is the default, since leaving a field
 * out lets the component's value through.
 */
export const OVERRIDE_ENCODERS = {
  stackPrimaryAlignItems: (node) => ({
    stackPrimaryAlignItems: normalizeStackJustify(node.primaryAxisAlign)
  }),
  stackCounterAlignItems: (node) => ({
    stackCounterAlignItems: normalizeStackCounterAlignItems(node.counterAxisAlign)
  }),
  blendMode: (node) => ({ blendMode: node.blendMode }),
  locked: (node) => ({ locked: node.locked }),
  effects: (node) => ({ effects: exportEffects(node) }),
  cornerRadius: (node) => ({
    cornerRadius: node.cornerRadius,
    rectangleTopLeftCornerRadius: node.topLeftRadius,
    rectangleTopRightCornerRadius: node.topRightRadius,
    rectangleBottomLeftCornerRadius: node.bottomLeftRadius,
    rectangleBottomRightCornerRadius: node.bottomRightRadius,
    rectangleCornerRadiiIndependent: node.independentCorners
  }),
  cornerSmoothing: (node) => ({ cornerSmoothing: node.cornerSmoothing }),
  // A layer's strokes hold its weight and alignment; without strokes it keeps its own.
  strokeWeight: (node) => ({ strokeWeight: node.strokes.at(0)?.weight ?? node.strokeWeight }),
  strokeAlign: (node) => ({ strokeAlign: node.strokes.at(0)?.align ?? node.strokeAlign }),
  strokeCap: (node) => ({ strokeCap: node.strokeCap }),
  strokeJoin: (node) => ({ strokeJoin: node.strokeJoin }),
  dashPattern: (node) => ({ dashPattern: [...node.dashPattern] }),
  borderStrokeWeightsIndependent: (node) => ({
    borderStrokeWeightsIndependent: node.independentStrokeWeights,
    borderTopWeight: node.borderTopWeight,
    borderRightWeight: node.borderRightWeight,
    borderBottomWeight: node.borderBottomWeight,
    borderLeftWeight: node.borderLeftWeight
  }),
  fontName: (node) => ({ fontName: exportFontName(node), fontVersion: '' }),
  lineHeight: (node) => ({
    lineHeight:
      node.lineHeight === null ? AUTO_LINE_HEIGHT : { value: node.lineHeight, units: 'PIXELS' }
  }),
  letterSpacing: (node) => ({ letterSpacing: { value: node.letterSpacing, units: 'PIXELS' } }),
  textCase: (node) => ({ textCase: node.textCase }),
  textDecoration: (node) => ({ textDecoration: node.textDecoration }),
  textAlignHorizontal: (node) => ({ textAlignHorizontal: node.textAlignHorizontal }),
  textAlignVertical: (node) => ({ textAlignVertical: node.textAlignVertical })
} as const satisfies Record<EncodedOverrideField, OverrideEncoder>
