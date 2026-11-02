import { describe, expect, test } from 'bun:test'

import type { StyleRun } from '@open-pencil/scene-graph'
import { remapStyleRunReferences, styleRunReferences } from '@open-pencil/scene-graph/text'

const RUNS: StyleRun[] = [
  { start: 0, length: 2, style: { boundVariables: { fontSize: 'v1' }, textStyleId: 's1' } },
  { start: 2, length: 2, style: { fillStyleId: 's2', hyperlink: { type: 'URL', value: 'x' } } },
  { start: 4, length: 2, style: { fontSize: 20 } }
]

describe('style run references', () => {
  test('list the variables and styles characters use', () => {
    expect(styleRunReferences(RUNS)).toEqual({ variables: ['v1'], styles: ['s1', 's2'] })
  })

  test('rename them, keeping runs without any as they are', () => {
    const renamed = remapStyleRunReferences(RUNS, {
      variable: (id) => `new-${id}`,
      style: (id) => `new-${id}`
    })
    expect(renamed.map((run) => run.style)).toEqual([
      { boundVariables: { fontSize: 'new-v1' }, textStyleId: 'new-s1' },
      { fillStyleId: 'new-s2', hyperlink: { type: 'URL', value: 'x' } },
      { fontSize: 20 }
    ])
    expect(renamed[2]).toBe(RUNS[2])
  })

  test('rename linked layers only when given a renaming for them', () => {
    const linked: StyleRun[] = [
      { start: 0, length: 4, style: { hyperlink: { type: 'NODE', value: 'frame' } } }
    ]
    const rename = { variable: (id: string) => id, style: (id: string) => id }
    expect(remapStyleRunReferences(linked, rename)[0]).toBe(linked[0])
    expect(
      remapStyleRunReferences(linked, { ...rename, node: (id) => `new-${id}` })[0].style
    ).toEqual({ hyperlink: { type: 'NODE', value: 'new-frame' } })
  })
})
