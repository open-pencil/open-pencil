import { describe, expect, test } from 'bun:test'

import { figmaSchema } from '../src/fig'
import { expectEnumValue, expectFieldNumber, validateSchema } from '../src/schema-runtime'

describe('bundled Figma Kiwi schema', () => {
  test('validates the static Figma schema', () => {
    validateSchema(figmaSchema)
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
