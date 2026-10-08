import { describe, expect, test } from 'bun:test'

import { parseJSXAttributes } from '#design-jsx/index'

describe('parseJSXAttributes', () => {
  test('splits attributes as written, including nested and bare ones', () => {
    expect(
      parseJSXAttributes(
        'w={200} name="a=b c" clipsContent strokes={[{ color: "#F00", dash: [4, 2] }]}'
      )
    ).toEqual([
      { name: 'w', source: 'w={200}' },
      { name: 'name', source: 'name="a=b c"' },
      { name: 'clipsContent', source: 'clipsContent' },
      { name: 'strokes', source: 'strokes={[{ color: "#F00", dash: [4, 2] }]}' }
    ])
  })

  test.each(['w={200', '{...props}', 'w=200'])('rejects %p', (source) => {
    expect(() => parseJSXAttributes(source)).toThrow('Invalid JSX attributes')
  })
})
