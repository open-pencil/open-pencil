import { expect, test } from 'bun:test'

import { tokenValidator } from '#dom-css/tokens/cssom-validator'
import { cssExpressionProblem, cssTokenProperty, cssValueTokens } from '#dom-css/tokens/expression'

const kinds = (source: string) =>
  cssValueTokens(source).map(({ kind, text }) => `${kind}:${text.trim()}`)

test('a finished var() is one reference token; math reads as functions, numbers and operators', () => {
  expect(kinds('clamp(1rem, 4vw, var(--space-md))')).toEqual([
    'function:clamp',
    'paren:(',
    'number:1rem',
    'separator:,',
    'number:4vw',
    'separator:,',
    'reference:var(--space-md)',
    'paren:)'
  ])
  expect(kinds('calc(var(--a) * 2 / 3)')).toEqual([
    'function:calc',
    'paren:(',
    'reference:var(--a)',
    'operator:*',
    'number:2',
    'operator:/',
    'number:3',
    'paren:)'
  ])
  const [reference] = cssValueTokens('var( --space-md )')
  expect(reference && cssTokenProperty(reference)).toBe('--space-md')
})

test('half-typed values still give the tokens completion needs', () => {
  expect(kinds('var(--sp')).toEqual(['function:var', 'paren:(', 'property:--sp'])
  expect(kinds('clamp(1rem, var(')).toEqual([
    'function:clamp',
    'paren:(',
    'number:1rem',
    'separator:,',
    'function:var',
    'paren:('
  ])
  // A var() with a fallback is not a plain reference, so it stays editable text.
  expect(kinds('var(--a, 4px)')).toEqual([
    'function:var',
    'paren:(',
    'property:--a',
    'separator:,',
    'number:4px',
    'paren:)'
  ])
})

const tokens = new Set(['--space-md'])
const problem = (css: string, unit: 'px' | 'none' = 'px') =>
  cssExpressionProblem(css, unit, tokens, tokenValidator, supports)
/** A stand-in for CSS.supports: lengths and numbers, and anything holding var(). */
const supports = (property: string, value: string) =>
  value.includes('var(') ||
  (property === 'width' ? /^(clamp|calc)\(|^\d+(px|rem|vw)$/.test(value) : /^\d+$/.test(value))

test('a CSS expression must be one well-formed value naming tokens that exist', () => {
  expect(problem('clamp(1rem, 4vw, var(--space-md))')).toBeUndefined()
  expect(problem('var(--space-md, 4px)')).toBeUndefined()
  expect(problem('clamp(1rem, 4vw')).toEqual({ kind: 'unclosed' })
  expect(problem('4px; color: red')).toEqual({ kind: 'syntax' })
  expect(problem('calc(var(--missing) * 2)')).toEqual({ kind: 'unknown-token', name: '--missing' })
  expect(problem('-var(--space-md)')).toEqual({
    kind: 'negated-reference',
    property: '--space-md'
  })
})

test('a CSS expression must suit the property its unit stands for', () => {
  expect(problem('4 apples')).toEqual({ kind: 'invalid', property: 'width' })
  expect(problem('4px', 'none')).toEqual({ kind: 'invalid', property: 'scale' })
  // Without a property check, as in the CLI, only the shape of the value is checked.
  expect(cssExpressionProblem('4 apples', 'px', tokens, tokenValidator)).toBeUndefined()
})
