import { describe, expect, test } from 'bun:test'

import { figmaSchema as figSchema } from '@open-pencil/kiwi/fig'
import {
  expectEnumValue,
  expectFieldNumber,
  validateSchema
} from '@open-pencil/kiwi/schema-runtime'

describe('Kiwi schema runtime', () => {
  test('validates the static Figma schema', () => {
    validateSchema(figSchema)
  })

  test('keeps the bundled schema aligned with a modern embedded Figma schema', () => {
    expect(figSchema.definitions).toHaveLength(605)
    expect(figSchema.definitions.some((def) => def.name === 'NodeChange')).toBe(true)
    expect(figSchema.definitions.some((def) => def.name === 'InteractiveSlideElementChange')).toBe(
      true
    )
  })

  test('keeps Figma clipboard-derived field numbers for emitted roundtrip fields', () => {
    expectFieldNumber(figSchema, 'Paint', 'colorVar', 21)
    expectFieldNumber(figSchema, 'TextLineData', 'sourceDirectionality', 9)
    expectFieldNumber(figSchema, 'NodeChange', 'pageType', 397)
    expectFieldNumber(figSchema, 'ComponentPropDef', 'varValue', 9)

    expectEnumValue(figSchema, 'VariableField', 'TEXT_DATA', 11)
    expectEnumValue(figSchema, 'VariableField', 'STACK_COUNTER_SPACING', 23)
    expectEnumValue(figSchema, 'VariableField', 'OVERRIDDEN_SYMBOL_ID', 37)
    expectEnumValue(figSchema, 'EditorType', 'DESIGN', 0)
    expectEnumValue(figSchema, 'EditorType', 'SLIDES', 2)
  })

  test('keeps Figma-derived field numbers for layout and glyph fields', () => {
    expectFieldNumber(figSchema, 'NodeChange', 'stackWrap', 323)
    expectFieldNumber(figSchema, 'NodeChange', 'stackCounterSpacing', 324)
    expectFieldNumber(figSchema, 'NodeChange', 'gridChildVerticalAlign', 476)
    expectFieldNumber(figSchema, 'NodeChange', 'gridChildHorizontalAlign', 477)
    expectFieldNumber(figSchema, 'Glyph', 'emojiCodePoints', 7)
    expectFieldNumber(figSchema, 'Glyph', 'rotation', 9)
  })
})
