import { describe, expect, test } from 'bun:test'

import { es, jsx } from '#emit/index'

const card = (attributes: ReturnType<typeof jsx.attribute>[], children = [jsx.text('Hi')]) =>
  jsx.printJSX(jsx.element('Card', attributes, children, 0, true))

describe('JSX attributes', () => {
  test('keep plain strings quoted', () => {
    expect(card([jsx.attribute('title', jsx.stringValue('Plain name'))])).toBe(
      '<Card title="Plain name">Hi</Card>'
    )
  })

  test.each(['a" w={999} x="', 'Fish &amp; chips', 'Back\\slash', 'Two\nlines'])(
    'write %p as a string literal JSX cannot reinterpret',
    (value) => {
      const code = card([jsx.attribute('title', jsx.stringValue(value))])
      expect(code).toBe(`<Card title={${JSON.stringify(value)}}>Hi</Card>`)
    }
  )

  test('print a null value as the bare name', () => {
    expect(card([jsx.attribute('wide', null)], [])).toBe('<Card wide />')
  })
})

describe('JSX text', () => {
  test('keeps plain text as text', () => {
    expect(card([], [jsx.text('Hello')])).toBe('<Card>Hello</Card>')
  })

  test.each(['{braces}', '<tag>', 'a & b', 'one\ntwo', ' padded '])(
    'writes %p as a string expression',
    (value) => {
      expect(card([], [jsx.text(value)])).toBe(`<Card>{${JSON.stringify(value)}}</Card>`)
    }
  )
})

describe('JSX elements', () => {
  test('put children on indented lines', () => {
    const child = jsx.element('Item', [], [], 1)
    expect(jsx.printJSX(jsx.element('List', [], [child, child], 0))).toBe(
      '<List>\n  <Item />\n  <Item />\n</List>'
    )
  })
})

describe('JSX modules', () => {
  test('print namespaced tags, spreads, and JSX inside a TypeScript module', () => {
    const body = jsx.element(
      'Switch.Root',
      [jsx.spread(es.identifier('props')), jsx.attribute('className', jsx.stringValue('switch'))],
      [jsx.element('Switch.Thumb', [], [], 2)],
      1
    )
    const module = es.fill(
      es.parseModule('export function Toggle(props: Props) { return $body }'),
      {
        $body: body
      }
    )
    expect(jsx.printModule(module)).toBe(
      [
        'export function Toggle(props: Props) {',
        '  return <Switch.Root {...props} className="switch">',
        '    <Switch.Thumb />',
        '  </Switch.Root>;',
        '}'
      ].join('\n')
    )
  })
})

describe('filling templates', () => {
  test('fill holes inside the annotation of a filled identifier', () => {
    const module = es.fill(es.parseModule("import a from 'a'\nfunction f($params: $Props) {}"), {
      $params: es.identifier('props'),
      $Props: es.identifier('ButtonProps')
    })
    expect(jsx.printModule(module)).toBe(
      ['import a from "a";', '', 'function f(props: ButtonProps) {}'].join('\n')
    )
  })
})

describe('numbers', () => {
  test('print as source writes them, a negative one with its sign', () => {
    expect(es.printExpression(es.number(2.5))).toBe('2.5')
    expect(es.printExpression(es.number(-10))).toBe('-10')
    expect(() => es.number(Number.NaN)).toThrow()
  })
})
