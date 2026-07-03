import { parse } from '@acemir/cssom'
import type { CSSStyleRuleLike } from '@acemir/cssom'

import type { DesignStyleDeclaration } from './types'

function firstStyleRule(cssText: string): CSSStyleRuleLike | null {
  const [rule] = parse(cssText).cssRules
  if (!rule || typeof rule !== 'object' || !('style' in rule)) return null
  return rule as CSSStyleRuleLike
}

export function parseStyleAttribute(value: string | undefined): DesignStyleDeclaration | undefined {
  if (!value) return undefined

  const rule = firstStyleRule(`*{${value}}`)
  if (!rule) return undefined

  const style: DesignStyleDeclaration = {}
  for (const property of Array.from(rule.style)) {
    const propertyValue = rule.style.getPropertyValue(property)
    if (propertyValue) style[property] = propertyValue
  }

  return Object.keys(style).length > 0 ? style : undefined
}
