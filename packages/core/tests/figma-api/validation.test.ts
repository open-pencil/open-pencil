import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { atLeast, finiteNumberSchema } from '#core/figma-api/schema'
import { parseFigma } from '#core/figma-api/validation'

// The rules come from messages measured in Figma desktop 126, which validates with Zod 4.

const refusal = (schema: v.GenericSchema, value: unknown) => {
  try {
    parseFigma(schema, value, 'set_example', 'example')
  } catch (error) {
    return error instanceof Error
      ? error.message.replace('in set_example: Property "example" failed validation: ', '')
      : String(error)
  }
  return null
}

describe('Figma’s validation messages', () => {
  test('numbers are finite, and bounds and integers are worded as Figma words them', () => {
    expect(refusal(finiteNumberSchema, 'a')).toBe('Expected number, received string')
    expect(refusal(finiteNumberSchema, Number.NaN)).toBe('Expected number, received NaN')
    expect(refusal(finiteNumberSchema, Infinity)).toBe('Expected number, received Infinity')
    expect(refusal(atLeast(1), 0)).toBe('Too small: expected number to be >=1')
    expect(refusal(v.pipe(finiteNumberSchema, v.maxValue(1)), 2)).toBe(
      'Too big: expected number to be <=1'
    )
    expect(refusal(v.pipe(finiteNumberSchema, v.integer()), 1.5)).toBe(
      'Expected int, received number'
    )
  })

  test('a field left out reads by what it must be', () => {
    const schema = v.object({
      unit: v.picklist(['PIXELS', 'PERCENT']),
      type: v.literal('SOLID'),
      value: finiteNumberSchema
    })
    expect(refusal(schema, {})).toBe(
      [
        'Invalid option: expected one of "PIXELS"|"PERCENT" at .unit',
        'Invalid input: expected "SOLID" at .type',
        'Required value missing at .value'
      ].join('\n')
    )
  })

  test('unknown keys are listed together, an array item by its index', () => {
    const item = v.strictObject({ axis: v.picklist(['X', 'Y']) })
    expect(refusal(item, { axis: 'X', r: 1, g: 2 })).toBe('Unrecognized keys: "r", "g"')
    expect(refusal(v.array(item), [{ axis: 'X' }, { axis: 'Y', foo: 1 }])).toBe(
      'Unrecognized key: "foo" at index 1'
    )
    expect(refusal(item, { axis: 'X', toString: 1, constructor: 2 })).toBe(
      'Unrecognized keys: "toString", "constructor"'
    )
    expect(refusal(v.array(item), [{ axis: 'Z' }])).toBe(
      'Invalid option: expected one of "X"|"Y" at [0].axis'
    )
  })

  test('a variant names its discriminator’s options, and refuses anything else as an object', () => {
    const length = v.variant('unit', [
      v.strictObject({ unit: v.picklist(['PIXELS', 'PERCENT']), value: finiteNumberSchema }),
      v.strictObject({ unit: v.literal('AUTO') })
    ])
    expect(refusal(length, { unit: 'EM' })).toBe(
      'Expected .unit to be one of the following: PIXELS, PERCENT, AUTO'
    )
    expect(refusal(v.array(length), [null])).toBe('Expected object, received null at index 0')
  })

  test('a choice settles on the one shape that matched but for its refinements', () => {
    const color = v.union([
      v.strictObject({
        value: v.strictObject({
          type: v.literal('SOLID'),
          color: v.strictObject({ r: v.pipe(finiteNumberSchema, v.maxValue(1)) })
        })
      }),
      v.strictObject({ value: v.literal('AUTO') })
    ])
    expect(refusal(color, { value: { type: 'SOLID', color: { r: 2 } } })).toBe(
      'Too big: expected number to be <=1 at .value.color.r'
    )
    expect(refusal(color, { value: 'RED' })).toBe(
      'Expected one of the following, but none matched:\n' +
        '  Expected object, received string at .value\n' +
        '  Invalid input: expected "AUTO" at .value'
    )
    expect(refusal(color, { value: { type: 'X' } })).toBe(
      'Expected one of the following, but none matched:\n' +
        '  Multiple issues:\n' +
        '    Invalid input: expected "SOLID" at .value.type\n' +
        '    Required value missing at .value.color\n' +
        '  Invalid input: expected "AUTO" at .value'
    )
    // Shapes that fail alike read once, as every shape fails a missing value.
    expect(refusal(color, undefined)).toBe(
      'Expected one of the following, but none matched:\n  Required value missing'
    )
    expect(parseFigma(color, { value: 'AUTO' }, 'set_example')).toEqual({ value: 'AUTO' })
  })

  test('a value that reads differently the second time reports what the first read found', () => {
    const choice = v.union([v.strictObject({ size: finiteNumberSchema }), v.literal('AUTO')])
    let reads = 0
    const value = {
      get size() {
        reads += 1
        return reads === 1 ? 'big' : 1
      }
    }
    expect(refusal(choice, value)).toBe(
      'Expected one of the following, but none matched:\n' +
        '  Expected number, received string at .size\n' +
        '  Invalid input: expected "AUTO"'
    )
  })

  test('a choice inside the value names where it sits', () => {
    const constraint = v.union([
      v.strictObject({ type: v.literal('SCALE'), value: finiteNumberSchema }),
      v.strictObject({ type: v.picklist(['WIDTH', 'HEIGHT']), value: finiteNumberSchema })
    ])
    const settings = v.array(v.object({ constraint: v.optional(constraint) }))
    expect(refusal(settings, [{ constraint: { type: 'SCALE' } }])).toBe(
      'Expected [0].constraint to be one of the following, but none matched:\n' +
        '  Required value missing at [0].constraint.value\n' +
        '  Multiple issues at [0].constraint:\n' +
        '    Invalid option: expected one of "WIDTH"|"HEIGHT" at [0].constraint.type\n' +
        '    Required value missing at [0].constraint.value'
    )
  })
})
