import { describe, expect, test } from 'bun:test'

import {
  SHAPE_WITH_TEXT_GROUPS,
  SHAPE_WITH_TEXT_TYPES,
  isShapeWithTextType
} from '@open-pencil/scene-graph/shape-with-text'

describe('shape-with-text kinds', () => {
  test('FigJam has 30 kinds, named as in .fig files and the plugin API', () => {
    expect(SHAPE_WITH_TEXT_TYPES).toHaveLength(30)
    expect(isShapeWithTextType('ENG_DATABASE')).toBe(true)
    expect(isShapeWithTextType('CLOUD')).toBe(false)
    expect(isShapeWithTextType(undefined)).toBe(false)
  })

  test("FigJam's Basic and Flowchart groups offer every kind once", () => {
    const grouped = [...SHAPE_WITH_TEXT_GROUPS.basic, ...SHAPE_WITH_TEXT_GROUPS.flowchart]
    expect(grouped.toSorted()).toEqual([...SHAPE_WITH_TEXT_TYPES].toSorted())
  })
})
