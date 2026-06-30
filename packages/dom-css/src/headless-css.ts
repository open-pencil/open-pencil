import {
  parse,
  type CSSGroupingRuleLike,
  type CSSStyleDeclarationLike,
  type CSSStyleRuleLike
} from '@acemir/cssom'

import type { DesignDocument, DesignElement, DesignNode, DesignStyleDeclaration } from './types'

interface HeadlessCSSRule {
  selector: string
  specificity: number
  order: number
  style: DesignStyleDeclaration
}

interface ParsedHeadlessCSS {
  rules: HeadlessCSSRule[]
  customProperties: DesignStyleDeclaration
}

interface AncestorContext {
  element: DesignElement
  parent: AncestorContext | null
}

const INHERITED_PROPERTIES = new Set([
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'line-height'
])

function styleToRecord(
  style: CSSStyleDeclarationLike,
  customProperties: DesignStyleDeclaration = {}
): DesignStyleDeclaration {
  const result: DesignStyleDeclaration = {}
  for (const property of Array.from({ length: style.length }, (_, index) => style[index])) {
    const value = resolveCSSValue(style.getPropertyValue(property), customProperties)
    if (property && value) result[property] = value
  }
  return expandStyleShorthands(result)
}

function isStyleRule(rule: unknown): rule is CSSStyleRuleLike {
  return (
    typeof rule === 'object' &&
    rule !== null &&
    'selectorText' in rule &&
    'style' in rule &&
    typeof rule.selectorText === 'string'
  )
}

function isGroupingRule(rule: unknown): rule is CSSGroupingRuleLike {
  return (
    typeof rule === 'object' && rule !== null && 'cssRules' in rule && Array.isArray(rule.cssRules)
  )
}

function collectStyleRules(rules: unknown[]): CSSStyleRuleLike[] {
  return rules.flatMap((rule) => {
    if (isStyleRule(rule)) return [rule]
    if (isGroupingRule(rule)) return collectStyleRules(rule.cssRules)
    return []
  })
}

function parseRules(cssText: string): ParsedHeadlessCSS {
  let order = 0
  const sheet = parse(cssText)
  const styleRules = collectStyleRules(sheet.cssRules)
  const customProperties = collectCustomProperties(styleRules)
  const rules = styleRules.flatMap((rule) => {
    const style = styleToRecord(rule.style, customProperties)
    return rule.selectorText
      .split(',')
      .map((selector) => selector.trim())
      .filter((selector) => selector.length > 0)
      .map((selector) => ({
        selector,
        specificity: selectorSpecificity(selector),
        order: order++,
        style
      }))
  })
  return { rules, customProperties }
}

function collectCustomProperties(rules: CSSStyleRuleLike[]): DesignStyleDeclaration {
  const customProperties: DesignStyleDeclaration = {}
  for (const rule of rules) {
    if (!rule.selectorText.split(',').some((selector) => selector.trim() === ':root')) continue
    Object.assign(customProperties, styleToRecord(rule.style))
  }
  return customProperties
}

function resolveCSSValue(value: string, customProperties: DesignStyleDeclaration): string {
  const withVariables = value.replaceAll(/var\((--[\w-]+)(?:,[^)]+)?\)/g, (_, name: string) => {
    return customProperties[name] ?? ''
  })
  return resolveSimpleCalc(withVariables)
}

function resolveSimpleCalc(value: string): string {
  const calc = value.match(/^calc\(([-\d.]+)(rem|px)?\s*\*\s*([-\d.]+)\)$/)
  if (!calc?.[1] || !calc[3]) return value

  const base = Number.parseFloat(calc[1])
  const multiplier = Number.parseFloat(calc[3])
  const unit = calc[2] ?? 'px'
  if (!Number.isFinite(base) || !Number.isFinite(multiplier)) return value
  return `${unit === 'rem' ? base * multiplier * 16 : base * multiplier}px`
}

function expandStyleShorthands(style: DesignStyleDeclaration): DesignStyleDeclaration {
  const result = { ...style }
  expandBoxShorthand(result, 'margin')
  expandBoxShorthand(result, 'padding')
  expandBorderShorthand(result)
  expandBackgroundShorthand(result)
  return result
}

function expandBoxShorthand(style: DesignStyleDeclaration, property: 'margin' | 'padding') {
  const value = style[property]
  if (!value) return

  const parts = splitWhitespace(value)
  const [top, right = top, bottom = top, left = right] = parts
  if (!top || !right || !bottom || !left) return

  style[`${property}-top`] ??= top
  style[`${property}-right`] ??= right
  style[`${property}-bottom`] ??= bottom
  style[`${property}-left`] ??= left
}

function expandBorderShorthand(style: DesignStyleDeclaration) {
  const value = style.border
  if (!value) return

  const parts = splitWhitespace(value)
  const color = parts.find(isLikelyColor)
  const width = parts.find((part) => /^\d/.test(part))
  if (color) style['border-color'] ??= color
  if (width) style['border-width'] ??= width
}

function expandBackgroundShorthand(style: DesignStyleDeclaration) {
  const value = style.background
  if (!value || style['background-color']) return

  const color = splitWhitespace(value).find(isLikelyColor)
  if (color) style['background-color'] = color
}

function splitWhitespace(value: string): string[] {
  return value
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
}

function isLikelyColor(value: string): boolean {
  return (
    value.startsWith('#') ||
    value.startsWith('rgb') ||
    value.startsWith('hsl') ||
    ['black', 'white', 'transparent', 'red', 'green', 'blue'].includes(value.toLowerCase())
  )
}

function classList(element: DesignElement): Set<string> {
  const className = 'class' in element.attrs ? element.attrs.class : ''
  return new Set(className.split(/\s+/).filter((name) => name.length > 0))
}

function elementId(element: DesignElement): string | undefined {
  return 'id' in element.attrs ? element.attrs.id : undefined
}

function selectorSpecificity(selector: string): number {
  const idCount = selector.match(/#[\w-]+/g)?.length ?? 0
  const classCount = selector.match(/\.[\w-]+/g)?.length ?? 0
  const tagCount = selector
    .split(/[\s>]+/)
    .filter((part) => part && !part.startsWith('.') && !part.startsWith('#')).length
  return idCount * 100 + classCount * 10 + tagCount
}

function matchesSimpleSelector(element: DesignElement, selector: string): boolean {
  if (selector.includes(':') || selector.includes('[')) return false

  const idMatch = selector.match(/#([\w-]+)/)
  if (idMatch?.[1] && elementId(element) !== idMatch[1]) return false

  const classes = selector.match(/\.[\w-]+/g) ?? []
  const elementClasses = classList(element)
  if (!classes.every((name) => elementClasses.has(name.slice(1)))) return false

  const tag = selector.replace(/#[\w-]+/g, '').replace(/\.[\w-]+/g, '')
  return tag.length === 0 || element.tagName.toLowerCase() === tag.toLowerCase()
}

function matchesSelector(
  element: DesignElement,
  selector: string,
  parent: AncestorContext | null
): boolean {
  const childParts = selector.split('>').map((part) => part.trim())
  if (childParts.length > 1) return matchesChildSelector(element, childParts, parent)

  const descendantParts = selector.split(/\s+/).filter((part) => part.length > 0)
  if (descendantParts.length > 1) return matchesDescendantSelector(element, descendantParts, parent)

  return matchesSimpleSelector(element, selector)
}

function matchesSelectorParts(
  element: DesignElement,
  parts: string[],
  parent: AncestorContext | null,
  directParentOnly: boolean
): boolean {
  const current = parts.at(-1)
  if (!current || !matchesSimpleSelector(element, current)) return false

  let ancestor = parent
  for (const selector of parts.slice(0, -1).reverse()) {
    if (!directParentOnly) {
      while (ancestor && !matchesSimpleSelector(ancestor.element, selector)) {
        ancestor = ancestor.parent
      }
    }
    if (!ancestor || !matchesSimpleSelector(ancestor.element, selector)) return false
    ancestor = ancestor.parent
  }
  return true
}

function matchesChildSelector(
  element: DesignElement,
  parts: string[],
  parent: AncestorContext | null
): boolean {
  return matchesSelectorParts(element, parts, parent, true)
}

function matchesDescendantSelector(
  element: DesignElement,
  parts: string[],
  parent: AncestorContext | null
): boolean {
  return matchesSelectorParts(element, parts, parent, false)
}

function applyComputedStyles(
  node: DesignNode,
  rules: HeadlessCSSRule[],
  parent: AncestorContext | null,
  inheritedStyle: DesignStyleDeclaration
): DesignNode {
  if (node.type === 'text') return node

  const computedStyle: DesignStyleDeclaration = pickInheritedStyle(inheritedStyle)
  const matchingRules = rules
    .filter((rule) => matchesSelector(node, rule.selector, parent))
    .sort((left, right) => left.specificity - right.specificity || left.order - right.order)

  for (const rule of matchingRules) Object.assign(computedStyle, rule.style)
  Object.assign(computedStyle, expandStyleShorthands(node.inlineStyle ?? {}))

  const context = { element: node, parent }
  return {
    ...node,
    computedStyle: Object.keys(computedStyle).length > 0 ? computedStyle : undefined,
    children: node.children.map((child) =>
      applyComputedStyles(child, rules, context, computedStyle)
    )
  }
}

function pickInheritedStyle(style: DesignStyleDeclaration): DesignStyleDeclaration {
  const inherited: DesignStyleDeclaration = {}
  for (const property of INHERITED_PROPERTIES) {
    const value = style[property]
    if (value) inherited[property] = value
  }
  return inherited
}

export function computeHeadlessStyles(document: DesignDocument, cssText = ''): DesignDocument {
  const stylesheetText = [document.stylesheets?.map((sheet) => sheet.cssText).join('\n'), cssText]
    .filter((text): text is string => !!text)
    .join('\n')
  const { rules } = parseRules(stylesheetText)

  return {
    ...document,
    children: document.children.map((child) => applyComputedStyles(child, rules, null, {}))
  }
}
