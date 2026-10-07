import type { CSSStyleSheetLike } from '@acemir/cssom'
import valueParser from 'postcss-value-parser'

type Parse = (cssText: string) => CSSStyleSheetLike

const AT_RULES = ['@media', '@supports', '@container'] as const

/** What a rule looks like to the checks below; the object model's own types are wider. */
type ParsedRule = {
  cssRules?: unknown[]
  selectorText?: string
  style?: { length: number; getPropertyValue(property: string): string }
}

function rules(sheet: CSSStyleSheetLike): ParsedRule[] {
  return sheet.cssRules.filter(
    (rule): rule is ParsedRule => typeof rule === 'object' && rule !== null
  )
}

/**
 * Token strings come from documents, so each one is parsed in place before it is written. A value
 * or condition that closes its rule early parses to a different number of rules and fails.
 */
export function createTokenValidator(parse: Parse) {
  /** `--name: value` is one declaration whose value reads back unchanged. */
  function declaration(name: string, value: string): boolean {
    const parsed = rules(parse(`:root{--${name}:${value}}`))
    const [rule] = parsed
    return (
      parsed.length === 1 &&
      rule.style?.length === 1 &&
      rule.style.getPropertyValue(`--${name}`).trim() === value.trim() &&
      (rule.cssRules?.length ?? 0) === 0
    )
  }

  return {
    declaration,

    /**
     * A custom property name without its `--`: one word to the CSS value tokenizer, which splits
     * on spaces, colons, commas and slashes, and one declaration to the parser. It starts with a
     * letter, digit or underscore, so `--` is never doubled into `----`.
     */
    name(name: string): boolean {
      const { nodes } = valueParser(`--${name}`)
      return (
        /^\w/.test(name) &&
        nodes.length === 1 &&
        nodes[0]?.type === 'word' &&
        declaration(name, '0')
      )
    },

    /** A selector, or a `@media`, `@supports` or `@container` prelude, that wraps exactly one rule. */
    condition(condition: string): boolean {
      const trimmed = condition.trim()
      if (trimmed.startsWith('@')) {
        if (
          !AT_RULES.some((rule) => trimmed.startsWith(`${rule} `) || trimmed.startsWith(`${rule}(`))
        )
          return false
        const parsed = rules(parse(`${trimmed}{:root{--t:0}}`))
        return parsed.length === 1 && parsed[0]?.cssRules?.length === 1
      }
      const parsed = rules(parse(`${trimmed}{--t:0}`))
      const [rule] = parsed
      return (
        parsed.length === 1 &&
        typeof rule.selectorText === 'string' &&
        rule.style?.length === 1 &&
        (rule.cssRules?.length ?? 0) === 0
      )
    }
  }
}

export type TokenValidator = ReturnType<typeof createTokenValidator>

/** The browser's own CSS parser, through a constructable stylesheet. */
export function parseWithBrowser(cssText: string): CSSStyleSheetLike {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(cssText)
  return { cssRules: [...sheet.cssRules] }
}
