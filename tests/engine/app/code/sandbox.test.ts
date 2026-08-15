import { describe, expect, test } from 'bun:test'

import { convertDesignJSXRoots } from '@/app/code/sandbox/convert'
import {
  DESIGN_JSX_MAX_ARRAY_LENGTH,
  DESIGN_JSX_MAX_DEPTH,
  DESIGN_JSX_MAX_ELEMENTS,
  DESIGN_JSX_MAX_OBJECT_KEYS,
  DESIGN_JSX_MAX_OUTPUT_BYTES,
  DESIGN_JSX_MAX_STRING_LENGTH,
  resolveDesignJSXValidationLimits
} from '@/app/code/sandbox/types'
import { validateDesignJSXOutput } from '@/app/code/sandbox/validate'

const limits = resolveDesignJSXValidationLimits({})

function frame(props: Record<string, unknown> = {}, children: unknown[] = []) {
  return { type: 'frame', props, children }
}

describe('Design JSX sandbox output', () => {
  test('resolves one complete validation contract', () => {
    expect(limits).toEqual({
      outputBytes: DESIGN_JSX_MAX_OUTPUT_BYTES,
      elements: DESIGN_JSX_MAX_ELEMENTS,
      depth: DESIGN_JSX_MAX_DEPTH,
      arrayLength: DESIGN_JSX_MAX_ARRAY_LENGTH,
      objectKeys: DESIGN_JSX_MAX_OBJECT_KEYS,
      stringLength: DESIGN_JSX_MAX_STRING_LENGTH
    })
  })

  test('validates and converts the same serialized element contract', () => {
    const roots = validateDesignJSXOutput(
      frame({ fill: { __openPencilHelper: 'solid', args: ['#ff0000'] } }, [
        { type: 'text', props: {}, children: ['Hello ', 2] }
      ]),
      limits
    )
    expect(convertDesignJSXRoots(roots)).toMatchObject([
      {
        type: 'frame',
        props: { fill: { type: 'SOLID' } },
        children: [{ type: 'text', children: ['Hello ', '2'] }]
      }
    ])
  })

  test('rejects empty output and malformed elements before rendering', () => {
    expect(() => validateDesignJSXOutput(undefined, limits)).toThrow(
      'must return an OpenPencil element'
    )
    expect(() => validateDesignJSXOutput([], limits)).toThrow('must return an OpenPencil element')
    expect(() => convertDesignJSXRoots([{ type: 'frame', props: {}, children: null }])).toThrow(
      'must return an OpenPencil element'
    )
  })

  test('rejects blocked keys and non-plain prototypes', () => {
    const blocked = Object.fromEntries([['safe', true]])
    Object.defineProperty(blocked, 'constructor', { value: 'blocked', enumerable: true })
    expect(() => validateDesignJSXOutput(frame(blocked), limits)).toThrow('blocked key')
    expect(() => validateDesignJSXOutput(frame({ value: new Date() }), limits)).toThrow(
      'plain structured data only'
    )
  })

  test('enforces array, object, string, and depth limits on the host', () => {
    expect(() =>
      validateDesignJSXOutput(
        frame({}, ['a', 'b']),
        resolveDesignJSXValidationLimits({ arrayLength: 1 })
      )
    ).toThrow('array')
    expect(() =>
      validateDesignJSXOutput(
        frame({ a: 1, b: 2 }),
        resolveDesignJSXValidationLimits({ objectKeys: 1 })
      )
    ).toThrow('object properties')
    expect(() =>
      validateDesignJSXOutput('abc', resolveDesignJSXValidationLimits({ stringLength: 2 }))
    ).toThrow('string')
    expect(() =>
      validateDesignJSXOutput([[['x']]], resolveDesignJSXValidationLimits({ depth: 2 }))
    ).toThrow('deeply nested')
  })

  test('counts container and primitive data toward the output limit', () => {
    const tiny = resolveDesignJSXValidationLimits({ outputBytes: 1 })
    expect(() => validateDesignJSXOutput([], tiny)).toThrow('must return an OpenPencil element')
    expect(() => validateDesignJSXOutput(true, tiny)).toThrow('too large')
    expect(() => validateDesignJSXOutput(1, tiny)).toThrow('too large')
    expect(() => validateDesignJSXOutput(frame(), tiny)).toThrow('too large')
  })

  test('rejects unknown helper descriptors during trusted conversion', () => {
    for (const helperName of ['unknown', 'toString', 'constructor', 'valueOf']) {
      const roots = validateDesignJSXOutput(
        frame({ fill: { __openPencilHelper: helperName, args: [] } }),
        limits
      )
      expect(() => convertDesignJSXRoots(roots)).toThrow('Unknown Design JSX helper')
    }
  })
})
