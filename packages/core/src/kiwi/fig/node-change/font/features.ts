import type { NodeChange } from '#core/kiwi/fig/codec'
import type { FontFeature } from '#core/scene-graph'

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
  toggledOff: string[]
): void {
  const booleanField = BOOLEAN_FEATURE_EXPORT[tag]
  if (booleanField) {
    nc[booleanField] = enabled
    return
  }

  const enumField = ENUM_FEATURE_EXPORT[tag]
  if (enabled && enumField) {
    nc[enumField.field] = enumField.value
    return
  }

  if (enabled) toggledOn.push(tag)
  else toggledOff.push(tag)
}

export function applyFontFeaturesToKiwi(nc: NodeChange, features: FontFeature[]): void {
  const toggledOn: string[] = []
  const toggledOff: string[] = []

  for (const feature of features) {
    applyFontFeatureToKiwi(nc, feature.tag.toUpperCase(), feature.enabled, toggledOn, toggledOff)
  }

  if (toggledOn.length > 0) nc.toggledOnOTFeatures = toggledOn
  if (toggledOff.length > 0) nc.toggledOffOTFeatures = toggledOff
}
