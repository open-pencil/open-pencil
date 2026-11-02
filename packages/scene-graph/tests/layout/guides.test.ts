import { describe, expect, test } from 'bun:test'

import {
  AUTO_LAYOUT_GRID_COUNT,
  layoutGuideLines,
  layoutGuideSections
} from '@lawha/scene-graph/layout'

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

  // Measured on Figma desktop 126's canvas: 40 px columns, a 10 px gutter, a 300 px frame.
  test('an Auto count fits as many sections as the frame holds, offset once from its edge', () => {
    const auto = (alignment: 'MIN' | 'CENTER' | 'MAX', offset: number) =>
      layoutGuideSections(
        { width: 300, height: 200 },
        {
          pattern: 'STRIPES',
          axis: 'X',
          type: alignment,
          numSections: AUTO_LAYOUT_GRID_COUNT,
          sectionSize: 40,
          gutterSize: 10,
          offset
        }
      ).map((section) => [section.start, section.end])
    const from = (start: number) =>
      Array.from({ length: 6 }, (_, index) => [start + index * 50, start + index * 50 + 40])
    expect(auto('MIN', 7)).toEqual(from(7))
    expect(auto('CENTER', 0)).toEqual(from(5))
    expect(auto('MAX', 7)).toEqual(from(3))
    expect(
      layoutGuideSections(
        { width: 300, height: 200 },
        { pattern: 'COLUMNS', alignment: 'MIN', count: Infinity, sectionSize: 40, gutterSize: 10 }
      )
    ).toHaveLength(6)
  })
})
