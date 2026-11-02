import { describe, expect, test } from 'bun:test'

import {
  DESIGN_JSX_ELEMENTS,
  DESIGN_JSX_SUPPORTED_PROPERTIES,
  transformDesignJSXExpression
} from '#design-jsx/index'

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

  test('lists the rich text elements and their props', () => {
    expect(DESIGN_JSX_ELEMENTS).toContainEqual(
      expect.objectContaining({ name: 'Span', runtimeType: 'text-span' })
    )
    expect(DESIGN_JSX_ELEMENTS).toContainEqual(
      expect.objectContaining({ name: 'Paragraph', runtimeType: 'text-paragraph' })
    )
    for (const property of ['list', 'level', 'spacing', 'listSpacing', 'indent']) {
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

  test('transforms statements that return the JSX', () => {
    const code = transformDesignJSXExpression(
      `const Card = ({ title }) => <Text>{title}</Text>
return <Card title="Hello" />`
    )
    expect(code).toContain('const Card')
    expect(code).toContain('return __h(Card')
  })

  test('rejects statements that return nothing', () => {
    expect(() => transformDesignJSXExpression('const value = 1')).toThrow()
  })
})
