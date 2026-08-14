import { describe, expect, test } from 'bun:test'

import {
  DESIGN_JSX_SUPPORTED_PROPERTIES,
  transformDesignJSXExpression
} from '@open-pencil/core/design-jsx'

describe('Design JSX schema', () => {
  test('includes renderer compatibility properties', () => {
    for (const property of [
      'name',
      'columnGap',
      'backgroundColor',
      'cornerSmoothing',
      'textDecoration',
      'componentId'
    ]) {
      expect(DESIGN_JSX_SUPPORTED_PROPERTIES.has(property)).toBe(true)
    }
  })
})

describe('Design JSX transform', () => {
  test('transforms a JSX expression', () => {
    const code = transformDesignJSXExpression('<Frame><Text>Hello</Text></Frame>')
    expect(code).toContain('__h(Frame')
    expect(code).toContain('__h(Text')
  })

  test('transforms declarations followed by a final expression', () => {
    const code = transformDesignJSXExpression(
      `const Card = ({ title }) => <Text>{title}</Text>
<Card title="Hello" />`
    )
    expect(code).toContain('const Card')
    expect(code).toContain('return (__h(Card')
  })

  test('rejects declarations without a final expression', () => {
    expect(() => transformDesignJSXExpression('const value = 1')).toThrow()
  })
})
