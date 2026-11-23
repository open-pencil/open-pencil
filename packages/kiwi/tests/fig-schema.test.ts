import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { figmaSchema } from '../src/fig'
import {
  expectEnumValue,
  expectFieldNumber,
  prettyPrintSchema,
  validateSchema
} from '../src/schema-runtime'

describe('bundled Figma Kiwi schema', () => {
  test('validates the static Figma schema', () => {
    validateSchema(figmaSchema)
  })

  test('is the text the printer writes, so regenerating it changes only what Figma changed', () => {
    const text = readFileSync(new URL('../src/fig/schema/fig.kiwi', import.meta.url), 'utf8')
    expect(prettyPrintSchema(figmaSchema)).toBe(text)
  })

  test('keeps high-value Figma schema guards stable', () => {
    expect(figmaSchema.definitions).toHaveLength(605)
    expect(figmaSchema.definitions.some((def) => def.name === 'NodeChange')).toBe(true)
    expect(
      figmaSchema.definitions.some((def) => def.name === 'InteractiveSlideElementChange')
    ).toBe(true)

    expectFieldNumber(figmaSchema, 'Paint', 'colorVar', 21)
    expectFieldNumber(figmaSchema, 'NodeChange', 'pageType', 397)
    expectEnumValue(figmaSchema, 'VariableField', 'OVERRIDDEN_SYMBOL_ID', 37)
  })
})
