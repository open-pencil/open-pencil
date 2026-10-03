import { describe, expect, test } from 'bun:test'

import { transformDesignJSXProgram } from '#design-jsx/index'

interface Located {
  type: string
  line: number
}

/** Runs transformed code with a JSX factory that records where each element was written. */
function locate(source: string): Located[] {
  const program = transformDesignJSXProgram(source)
  const located: Located[] = []
  const h = (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => {
    if (typeof type === 'function')
      return (type as (props: unknown) => unknown)({ ...props, children })
    const origin = props?.__source as { fileName: 'statements' | 'expression'; lineNumber: number }
    located.push({
      type: String(type),
      line: program.lineOffsets[origin.fileName] + origin.lineNumber
    })
    return null
  }
  // eslint-disable-next-line typescript-eslint/no-implied-eval -- evaluates the transformed test fixture
  new Function('__h', '__fragment', 'Frame', 'Text', program.code)(h, '', 'frame', 'text')
  return located
}

describe('transformDesignJSXProgram', () => {
  test('reports the source line of elements in a plain expression', () => {
    const source = `\n\n<Frame name="Card">\n  <Text>Hi</Text>\n</Frame>`
    expect(locate(source).map(({ type, line }) => `${type}@${line}`)).toEqual(['text@4', 'frame@3'])
  })

  test('reports lines in both declarations and the final expression of a program', () => {
    const source = [
      '',
      'const Card = () => (',
      '  <Frame>',
      '    <Text>Hi</Text>',
      '  </Frame>',
      ')',
      '',
      '<Frame name="Root">',
      '  <Card />',
      '</Frame>'
    ].join('\n')
    expect(locate(source).map(({ type, line }) => `${type}@${line}`)).toEqual([
      'text@4',
      'frame@3',
      'frame@8'
    ])
  })
})
