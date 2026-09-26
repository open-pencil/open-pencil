import { describe, expect, test } from 'bun:test'

import { getTool, setupToolTest, type ToolResult } from '#tests/helpers/tools'

function run(expr: string): ToolResult {
  const { figma } = setupToolTest()
  return getTool('calc').execute(figma, { expr }) as ToolResult
}

describe('calc tool', () => {
  test('returns a single result for one expression', () => {
    expect(run('844 - 56 - 96 - 82')).toEqual({ expr: '844 - 56 - 96 - 82', result: 610 })
  })

  test('evaluates a JSON array in one call, preserving order', () => {
    expect(run('["1440 * 8 / 12", "(952 - 16) / 2", "floor(390 * 0.6)"]')).toEqual({
      results: [
        { expr: '1440 * 8 / 12', result: 960 },
        { expr: '(952 - 16) / 2', result: 468 },
        { expr: 'floor(390 * 0.6)', result: 234 }
      ]
    })
  })

  test('treats a single-element array like a bare expression', () => {
    expect(run('["2 + 2"]')).toEqual({ expr: '2 + 2', result: 4 })
  })

  test('reports the documented ** operator', () => {
    expect(run('2 ** 10')).toEqual({ expr: '2 ** 10', result: 1024 })
  })

  test('reports a non-finite result as an error rather than a number', () => {
    expect(run('1 / 0')).toEqual({ expr: '1 / 0', error: 'Produced Infinity' })
    expect(run('0 / 0')).toEqual({ expr: '0 / 0', error: 'Produced NaN' })
  })

  test('reports a rejected expression without failing its siblings', () => {
    const result = run('["2 + 2", "2 +", "3 * 3"]')
    expect(result.results).toEqual([
      { expr: '2 + 2', result: 4 },
      { expr: '2 +', error: 'Expected expression after + at character 3' },
      { expr: '3 * 3', result: 9 }
    ])
  })

  test('evaluates text that only looks like JSON as an expression', () => {
    expect(run('2 + 2')).toEqual({ expr: '2 + 2', result: 4 })
    expect((run('{"a": 1}') as { error: string }).error).toContain('Unexpected "{"')
  })

  test('advertises exactly the functions it supports', () => {
    const { description } = getTool('calc')
    for (const name of ['min', 'max', 'floor', 'ceil', 'round', 'abs', 'sqrt', 'pow']) {
      expect(description).toContain(name)
    }
    expect(description).toContain('**')
  })
})
