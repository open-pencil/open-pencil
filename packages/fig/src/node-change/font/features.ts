import { figmaSchema } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { FontFeature } from '@open-pencil/scene-graph'

/**
 * `toggledOn/OffOTFeatures` are typed as `OpenTypeFeature[]`, so only tags Figma's schema
 * can encode belong there. Everything else has to map to a typed text field, or the encoder
 * rejects the tag and the whole `.fig` export fails.
 */
const OT_FEATURE_TAGS: ReadonlySet<string> = new Set(
  (
    figmaSchema.definitions.find((definition) => definition.name === 'OpenTypeFeature')?.fields ??
    []
  ).map((field) => field.name)
)

const BOOLEAN_FEATURES = [
  ['fontVariantCommonLigatures', 'LIGA'],
  ['fontVariantContextualLigatures', 'CALT'],
  ['fontVariantDiscretionaryLigatures', 'DLIG'],
  ['fontVariantHistoricalLigatures', 'HLIG'],
  ['fontVariantOrdinal', 'ORDN'],
  ['fontVariantSlashedZero', 'ZERO']
] as const

const ENUM_FEATURES = [
  ['fontVariantNumericFigure', { LINING: 'LNUM', OLDSTYLE: 'ONUM' }],
  ['fontVariantNumericSpacing', { PROPORTIONAL: 'PNUM', TABULAR: 'TNUM' }],
  ['fontVariantNumericFraction', { DIAGONAL: 'FRAC', STACKED: 'AFRC' }],
  [
    'fontVariantCaps',
    {
      SMALL: 'SMCP',
      PETITE: 'PCAP',
      ALL_SMALL: ['SMCP', 'C2SC'],
      ALL_PETITE: ['PCAP', 'C2PC'],
      UNICASE: 'UNIC',
      TITLING: 'TITL'
    }
  ]
] as const

const BOOLEAN_FEATURE_EXPORT = Object.fromEntries(
  BOOLEAN_FEATURES.map(([field, tag]) => [tag, field])
) as Partial<Record<string, (typeof BOOLEAN_FEATURES)[number][0]>>

const ENUM_FEATURE_EXPORT: Partial<
  Record<string, { field: (typeof ENUM_FEATURES)[number][0]; value: string }>
> = {
  LNUM: { field: 'fontVariantNumericFigure', value: 'LINING' },
  ONUM: { field: 'fontVariantNumericFigure', value: 'OLDSTYLE' },
  PNUM: { field: 'fontVariantNumericSpacing', value: 'PROPORTIONAL' },
  TNUM: { field: 'fontVariantNumericSpacing', value: 'TABULAR' },
  FRAC: { field: 'fontVariantNumericFraction', value: 'DIAGONAL' },
  AFRC: { field: 'fontVariantNumericFraction', value: 'STACKED' },
  SMCP: { field: 'fontVariantCaps', value: 'SMALL' },
  PCAP: { field: 'fontVariantCaps', value: 'PETITE' },
  C2SC: { field: 'fontVariantCaps', value: 'ALL_SMALL' },
  C2PC: { field: 'fontVariantCaps', value: 'ALL_PETITE' },
  UNIC: { field: 'fontVariantCaps', value: 'UNICASE' },
  TITL: { field: 'fontVariantCaps', value: 'TITLING' }
}

function addFeature(features: FontFeature[], tag: string, enabled: boolean): void {
  const normalizedTag = tag.toUpperCase()
  if (features.some((feature) => feature.tag === normalizedTag)) return
  features.push({ tag: normalizedTag, enabled })
}

export function convertFontFeatures(nc: NodeChange): FontFeature[] {
  const features: FontFeature[] = []
  for (const [field, tag] of BOOLEAN_FEATURES) {
    const enabled = nc[field]
    if (enabled !== undefined) addFeature(features, tag, enabled)
  }
  for (const [field, values] of ENUM_FEATURES) {
    const tag = (values as Partial<Record<string, string | string[]>>)[String(nc[field])]
    if (Array.isArray(tag)) {
      for (const item of tag) addFeature(features, item, true)
    } else if (tag) addFeature(features, tag, true)
  }
  for (const tag of nc.toggledOnOTFeatures ?? []) addFeature(features, tag, true)
  for (const tag of nc.toggledOffOTFeatures ?? []) addFeature(features, tag, false)
  return features
}

function applyFontFeatureToKiwi(
  nc: NodeChange,
  tag: string,
  enabled: boolean,
  toggledOn: string[],
  toggledOff: string[],
  clearedAxes: Map<string, 'NORMAL'>
): void {
  const booleanField = BOOLEAN_FEATURE_EXPORT[tag]
  if (booleanField) {
    nc[booleanField] = enabled
    return
  }

  const enumField = ENUM_FEATURE_EXPORT[tag]
  if (enumField) {
    // Each axis holds one value, so a disabled toggle clears it to the neutral value rather
    // than inventing the opposite. An enabled tag for the same axis wins over a disabled one,
    // because text such as "TNUM on, PNUM off" describes that one state.
    if (enabled) {
      nc[enumField.field] = enumField.value
      clearedAxes.delete(enumField.field)
    } else if (nc[enumField.field] === undefined) {
      clearedAxes.set(enumField.field, 'NORMAL')
    }
    return
  }

  // A tag the schema cannot express is dropped rather than written as an invalid enum member.
  if (!OT_FEATURE_TAGS.has(tag)) return

  if (enabled) toggledOn.push(tag)
  else toggledOff.push(tag)
}

export function applyFontFeaturesToKiwi(nc: NodeChange, features: FontFeature[]): void {
  const toggledOn: string[] = []
  const toggledOff: string[] = []
  // Applied after the loop so a later enabled tag can cancel a pending clear.
  const clearedAxes = new Map<string, 'NORMAL'>()

  for (const feature of features) {
    applyFontFeatureToKiwi(
      nc,
      feature.tag.toUpperCase(),
      feature.enabled,
      toggledOn,
      toggledOff,
      clearedAxes
    )
  }
  for (const field of clearedAxes.keys()) nc[field] = 'NORMAL'

  if (toggledOn.length > 0) nc.toggledOnOTFeatures = toggledOn
  if (toggledOff.length > 0) nc.toggledOffOTFeatures = toggledOff
}
