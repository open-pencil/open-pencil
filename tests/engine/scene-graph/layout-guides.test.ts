import { describe, expect, test } from 'bun:test'

import { layoutGuideLines, layoutGuideSections } from '@open-pencil/scene-graph/layout-guides'

describe('layout guide geometry bounds', () => {
  test('normalizes fractional section counts', () => {
    expect(
      layoutGuideSections(
        { width: 100, height: 100 },
        { pattern: 'COLUMNS', count: 2.8, sectionSize: 10 }
      )
    ).toHaveLength(2)
  })

  test('caps pathological section and grid line counts', () => {
    expect(
      layoutGuideSections(
        { width: 100, height: 100 },
        { pattern: 'COLUMNS', count: Number.MAX_SAFE_INTEGER, sectionSize: 0.001 }
      )
    ).toHaveLength(10_000)
    expect(
      layoutGuideLines(
        { width: 100, height: 100 },
        { pattern: 'GRID', sectionSize: Number.MIN_VALUE }
      )
    ).toHaveLength(20_000)
  })
})
