// eslint-disable-next-line open-pencil/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { parse, type CssNodePlain as CSSNodePlain, type FeaturePlain } from 'css-tree'

/** What a feature is tested against: a keyword such as `dark`, or a length such as `640px`. */
export type FeatureValue =
  | { type: 'keyword'; name: string }
  | { type: 'dimension'; value: number; unit: string }

/** An at-rule that tests one feature: `@media (prefers-color-scheme: dark)`. */
export interface FeatureCondition {
  rule: 'media' | 'container'
  /** `prefers-color-scheme`, lowercase. */
  feature: string
  value: FeatureValue
}

/** The one feature a prelude tests, when it tests exactly one and nothing else. */
function onlyFeature(nodes: readonly CSSNodePlain[]): FeaturePlain | undefined {
  const [node] = nodes
  if (nodes.length !== 1) return undefined
  if (node.type === 'Feature') return node
  if (node.type === 'Condition') return onlyFeature(node.children)
  if (node.type === 'MediaQueryList') return onlyFeature(node.children)
  if (node.type === 'MediaQuery' && !node.modifier && !node.mediaType && node.condition)
    return onlyFeature([node.condition])
  return undefined
}

function featureValue(node: FeaturePlain['value']): FeatureValue | undefined {
  if (node?.type === 'Identifier') return { type: 'keyword', name: node.name.toLowerCase() }
  if (node?.type !== 'Dimension') return undefined
  const value = Number(node.value)
  return Number.isFinite(value)
    ? { type: 'dimension', value, unit: node.unit.toLowerCase() }
    : undefined
}

/**
 * Reads a condition with css-tree, so spacing, case and comments do not change what it tests, and
 * only what CSS calls whitespace separates its parts. Undefined for anything but one `@media` or
 * unnamed `@container` rule testing one feature: a selector, `@media screen`, or
 * `@media (a: b) and (c: d)`.
 */
export function parseFeatureCondition(css: string): FeatureCondition | undefined {
  const errors: unknown[] = []
  const sheet = parse(`${css}{}`, {
    list: false,
    positions: false,
    onParseError: (error) => errors.push(error)
  })
  if (errors.length > 0 || sheet.type !== 'StyleSheet' || sheet.children.length !== 1)
    return undefined
  const [rule] = sheet.children
  if (rule.type !== 'Atrule' || rule.prelude?.type !== 'AtrulePrelude') return undefined
  const name = rule.name.toLowerCase()
  if (name !== 'media' && name !== 'container') return undefined
  const feature = onlyFeature(rule.prelude.children)
  const value = feature && featureValue(feature.value)
  return feature && value ? { rule: name, feature: feature.name.toLowerCase(), value } : undefined
}

/** The condition as the stylesheet writes it: `@media (max-width: 640px)`. */
export function featureConditionCSS({ rule, feature, value }: FeatureCondition): string {
  const written = value.type === 'keyword' ? value.name : `${value.value}${value.unit}`
  return `@${rule} (${feature}: ${written})`
}
