import type { NodeChange, VariableConsumptionEntry } from '@open-pencil/kiwi/fig/codec'

import {
  TEXT_STYLE_FIELDS,
  type StyleSource,
  type TextStyleLookup
} from '../node-change/style/lookup'
import { variableConsumptionEntries } from '../node-change/variable/bindings'
import { declareVariableBindingUnits } from './bindings/variables'
import type { InstanceOccurrence } from './occurrence/types'

/** In Figma a decoration override keeps the text style attached; every other style field detaches it. */
const FIELDS_AN_OVERRIDE_DETACHES = TEXT_STYLE_FIELDS.filter((field) => field !== 'textDecoration')

type DetachingField = (typeof FIELDS_AN_OVERRIDE_DETACHES)[number]

const BINDINGS_OF_FIELD: Record<DetachingField, readonly string[]> = {
  fontSize: ['FONT_SIZE'],
  fontName: ['FONT_FAMILY', 'FONT_STYLE'],
  lineHeight: ['LINE_HEIGHT'],
  letterSpacing: ['LETTER_SPACING'],
  textCase: []
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

function bindsField(bound: ReadonlySet<string>, field: DetachingField): boolean {
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

/** Figma draws an inherited text style's values and bindings over those a claim saves beside it (saved glyphs and live probe, desktop 126). */
export function yieldToInheritedTextStyle(
  target: InstanceOccurrence,
  claim: Partial<NodeChange>,
  textStyle: TextStyleLookup
): void {
  if ('styleIdForText' in claim) {
    return
  }
  const claimBound = boundVariableFields(claim)
  const touched = FIELDS_AN_OVERRIDE_DETACHES.filter(
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
  const yielded = touched.filter(
    (field) => style[field] !== undefined || bindsField(styleBound, field)
  )
  for (const field of yielded) {
    const styleValue = style[field]
    Reflect.deleteProperty(claim, field)
    if (styleValue !== undefined) {
      Object.assign(target.properties, { [field]: structuredClone(styleValue) })
    }
  }
  const yieldedBindings = new Set(yielded.flatMap((field) => BINDINGS_OF_FIELD[field]))
  dropBindings(claim, yieldedBindings)
  adoptStyleBindings(target, style, yieldedBindings)
}
