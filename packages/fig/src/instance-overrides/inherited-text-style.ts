import type { NodeChange, VariableConsumptionEntry } from '@open-pencil/kiwi/fig/codec'

import {
  TEXT_STYLE_FIELDS,
  type StyleSource,
  type TextStyleField,
  type TextStyleLookup
} from '../node-change/style/lookup'
import { variableConsumptionEntries } from '../node-change/variable/bindings'
import { declareVariableBindingUnits } from './bindings/variables'
import type { InstanceOccurrence } from './occurrence/types'

const BINDINGS_OF_FIELD: Record<TextStyleField, readonly string[]> = {
  fontSize: ['FONT_SIZE'],
  fontName: ['FONT_FAMILY', 'FONT_STYLE'],
  lineHeight: ['LINE_HEIGHT'],
  letterSpacing: ['LETTER_SPACING'],
  textDecoration: [],
  textCase: []
}

/** The values a text style record leaves out, as Figma omits a field at its default. */
const STYLE_DEFAULTS: Partial<Pick<NodeChange, TextStyleField>> = {
  textDecoration: 'NONE',
  textCase: 'ORIGINAL'
}

const CONSUMPTION_MAPS = ['variableConsumptionMap', 'parameterConsumptionMap'] as const

type ConsumptionHolder = Pick<NodeChange, (typeof CONSUMPTION_MAPS)[number]>

function boundVariableFields(holder: ConsumptionHolder): Set<string> {
  return new Set(
    variableConsumptionEntries(holder).flatMap((entry) =>
      entry.variableField === undefined ? [] : [entry.variableField]
    )
  )
}

function bindsField(bound: ReadonlySet<string>, field: TextStyleField): boolean {
  return BINDINGS_OF_FIELD[field].some((variableField) => bound.has(variableField))
}

function withoutBindings(
  entries: readonly VariableConsumptionEntry[] | undefined,
  variableFields: ReadonlySet<string>
): VariableConsumptionEntry[] {
  return (entries ?? []).filter(
    (entry) => entry.variableField === undefined || !variableFields.has(entry.variableField)
  )
}

function dropBindings(holder: ConsumptionHolder, variableFields: ReadonlySet<string>): void {
  for (const map of CONSUMPTION_MAPS) {
    const current = holder[map]
    if (!current) {
      continue
    }
    const kept = withoutBindings(current.entries, variableFields)
    if (kept.length === 0) {
      Reflect.deleteProperty(holder, map)
    } else {
      holder[map] = { ...current, entries: kept }
    }
  }
}

function adoptStyleBindings(
  target: InstanceOccurrence,
  style: Partial<StyleSource>,
  variableFields: ReadonlySet<string>
): void {
  const styleBindings = variableConsumptionEntries(style).filter(
    (entry) => entry.variableField !== undefined && variableFields.has(entry.variableField)
  )
  dropBindings(target.properties, variableFields)
  if (styleBindings.length === 0) {
    return
  }
  const adopted = structuredClone(styleBindings)
  const ownEntries = target.properties.parameterConsumptionMap?.entries ?? []
  target.properties.parameterConsumptionMap = { entries: [...ownEntries, ...adopted] }
  declareVariableBindingUnits(target, { parameterConsumptionMap: { entries: adopted } })
}

/**
 * Figma draws an inherited text style's values and bindings over those a claim saves beside it
 * (saved glyphs and live probe, desktop 126). A decoration or case set after the style is saved in
 * the text's runs, so one claimed here was set before the style and gives way too.
 */
export function yieldToInheritedTextStyle(
  target: InstanceOccurrence,
  claim: Partial<NodeChange>,
  textStyle: TextStyleLookup
): void {
  if ('styleIdForText' in claim) {
    return
  }
  const claimBound = boundVariableFields(claim)
  const touched = TEXT_STYLE_FIELDS.filter(
    (field) => field in claim || bindsField(claimBound, field)
  )
  if (touched.length === 0) {
    return
  }
  const style = textStyle(target.properties.styleIdForText)
  if (!style) {
    return
  }
  const styleBound = boundVariableFields(style)
  const styleValueOf = (field: TextStyleField) => style[field] ?? STYLE_DEFAULTS[field]
  const yielded = touched.filter(
    (field) => styleValueOf(field) !== undefined || bindsField(styleBound, field)
  )
  for (const field of yielded) {
    const styleValue = styleValueOf(field)
    Reflect.deleteProperty(claim, field)
    if (styleValue !== undefined) {
      Object.assign(target.properties, { [field]: structuredClone(styleValue) })
    }
  }
  const yieldedBindings = new Set(yielded.flatMap((field) => BINDINGS_OF_FIELD[field]))
  dropBindings(claim, yieldedBindings)
  adoptStyleBindings(target, style, yieldedBindings)
}
