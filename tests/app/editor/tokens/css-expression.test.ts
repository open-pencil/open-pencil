import { expect, test } from 'bun:test'

import { cssExpressionPreview } from '@/app/editor/tokens/css-expression'

test('a CSS expression previews what the browser computes, in stored units', () => {
  const calls: Array<[string, string, string[]]> = []
  /** A stand-in for the browser: every value computes to 20 of the property's unit. */
  const measure = (property: string, value: string, variables: ReadonlyMap<string, string>) => {
    calls.push([property, value, [...variables.keys()]])
    return property === 'transition-duration' ? '0.15s' : '20px'
  }
  const tokens = new Map([['--space-md', '8px']])
  expect(cssExpressionPreview('calc(12px + var(--space-md))', 'px', tokens, measure)).toEqual({
    value: 20,
    approximate: false
  })
  expect(calls.at(-1)).toEqual(['width', 'calc(12px + var(--space-md))', ['--space-md']])
  expect(cssExpressionPreview('clamp(1rem, 4vw, 2rem)', 'rem', tokens, measure)).toEqual({
    value: 20,
    approximate: true
  })
  expect(cssExpressionPreview('calc(100ms + 50ms)', 'ms', tokens, measure)?.value).toBe(150)
  // A percentage resolves against a container, and an unknown token has no value to use.
  expect(cssExpressionPreview('50%', 'px', tokens, measure)).toBeUndefined()
  expect(cssExpressionPreview('var(--missing)', 'px', tokens, measure)).toBeUndefined()
  expect(cssExpressionPreview('4px', '%', tokens, measure)).toBeUndefined()
})
