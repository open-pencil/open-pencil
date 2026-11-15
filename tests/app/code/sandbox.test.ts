import { describe, expect, test } from 'bun:test'

import { isLayerRef, isMode, isVariable } from '@open-pencil/design-jsx'

import { convertDesignJSXRoots } from '@/app/code/sandbox/convert'
import { sandboxDocument } from '@/app/code/sandbox/document'
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
import { runDesignJSX } from '@/app/code/sandbox/worker/run'

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

  test('converts every helper the renderer gives JSX, and nothing else', () => {
    const [frameWithShader] = convertDesignJSXRoots(
      validateDesignJSXOutput(
        frame({ fill: { __openPencilHelper: 'shader', args: [[{ type: 'Aurora', props: {} }]] } }),
        limits
      )
    )
    expect(frameWithShader.props.fill).toMatchObject({
      shader: { components: [{ type: 'Aurora' }] }
    })
    expect(() =>
      convertDesignJSXRoots([frame({ fill: { __openPencilHelper: 'isVariableInput', args: [] } })])
    ).toThrow('Unknown Design JSX helper "isVariableInput"')
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

  test('converts each numbered ref() to one handle across the elements of an evaluation', () => {
    const marked = (number: number) => ({ __openPencilHelper: 'ref', args: [number] })
    const [first, second, connector] = convertDesignJSXRoots([
      frame({ ref: marked(1) }),
      frame({ ref: marked(2) }),
      { type: 'connector', props: { from: marked(1), to: marked(2) }, children: [] }
    ])
    expect(isLayerRef(first.props.ref)).toBe(true)
    expect(connector.props.from).toBe(first.props.ref)
    expect(connector.props.to).toBe(second.props.ref)
    expect(first.props.ref).not.toBe(second.props.ref)
  })

  test('converts each written collection once, its modes able to alias its own variables', () => {
    const variable = (name: string) => ({ __openPencilHelper: 'variable', args: [0, name] })
    const collections = [
      {
        collection: 'Theme',
        values: { Page: '#ffffff', Text: '#111111' },
        options: { mode: 'Light' },
        modes: [{ mode: 'Dark', values: { Page: '#111111', Text: variable('Page') } }]
      }
    ]
    const roots = validateDesignJSXOutput(
      [
        frame({ fill: variable('Page'), mode: { __openPencilHelper: 'mode', args: [0, 'Dark'] } }),
        frame({ fill: variable('Page') })
      ],
      limits,
      collections
    )
    const [first, second] = convertDesignJSXRoots(roots, undefined, collections)
    const page = first.props.fill
    if (!isVariable(page) || typeof page.collection !== 'object')
      throw new Error('Expected a defined variable')
    expect(second.props.fill).toBe(page)
    expect(isMode(first.props.mode) && first.props.mode.collection).toBe(page.collection)
    expect(page.collection.modes).toEqual([
      { name: 'Light', values: { Page: '#ffffff', Text: '#111111' } },
      { name: 'Dark', values: { Page: '#111111', Text: page } }
    ])
    expect(() =>
      convertDesignJSXRoots([frame({ fill: { __openPencilHelper: 'variable', args: [3, 'X'] } })])
    ).toThrow('Unknown variable collection')
  })

  test('evaluates Design JSX into plain data in the worker', () => {
    const run = (id: string, code: string) =>
      runDesignJSX({
        id,
        code,
        elements: { Frame: 'frame', 'Button.Root': 'Button.Root' },
        helpers: ['solid', 'ref', 'defineVars', 'defineMode'],
        limits
      })
    expect(
      run(
        'theme',
        `const t = defineVars('Theme', { Page: '#fff' }); const dark = defineMode(t, 'Dark', {})
return __h(Frame, { fill: t.Page, mode: dark }, __h(Button.Root, null), 'Hi', false)`
      )
    ).toEqual({
      id: 'theme',
      ok: true,
      value: {
        type: 'frame',
        props: {
          fill: { __openPencilHelper: 'variable', args: [0, 'Page'] },
          mode: { __openPencilHelper: 'mode', args: [0, 'Dark'] }
        },
        children: [{ type: 'Button.Root', props: {}, children: [] }, 'Hi']
      },
      collections: [
        {
          collection: 'Theme',
          values: { Page: '#fff' },
          options: {},
          modes: [{ mode: 'Dark', values: {} }]
        }
      ]
    })
    expect(run('none', 'const frame = __h(Frame, null)')).toEqual({
      id: 'none',
      ok: false,
      error: 'Design JSX must return an OpenPencil element.'
    })
    expect(run('date', 'return __h(Frame, { when: new Date(0) })')).toEqual({
      id: 'date',
      ok: false,
      error: 'Design JSX output must contain plain structured data only.'
    })
  })

  test('refuses a frame script that would close its own script element', () => {
    expect(sandboxDocument('run()')).toContain('<script>run()</script>')
    expect(() => sandboxDocument('"</script><script>alert(1)"')).toThrow('cannot be inlined')
    expect(() => sandboxDocument('"</SCRIPT><script>alert(1)"')).toThrow('cannot be inlined')
  })
})
