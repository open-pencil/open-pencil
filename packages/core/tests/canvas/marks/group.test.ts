import { describe, expect, test } from 'bun:test'

import { groupMarks } from '#core/canvas/marks/group'

const at = (x: number, y: number) => ({ x, y, width: 0, height: 0 })

describe('groupMarks', () => {
  test('marks within the gap share a group, in the order they arrive', () => {
    const groups = groupMarks(
      [
        { item: 'a', rect: at(0, 0) },
        { item: 'b', rect: at(100, 0) },
        { item: 'c', rect: at(10, 10) }
      ],
      20
    )
    expect(groups.map((group) => group.items)).toEqual([['a', 'c'], ['b']])
    expect(groups[0]?.rect).toEqual(at(0, 0))
  })

  test('later marks are measured against where a group has moved', () => {
    const center = (items: readonly { x: number }[]) =>
      at(items.reduce((sum, item) => sum + item.x, 0) / items.length, 0)
    const marks = [0, 18, 27].map((x) => ({ item: { x }, rect: at(x, 0) }))

    // Measured from the first mark, the third is too far; from the pair's center it is close.
    expect(groupMarks(marks, 20)).toHaveLength(2)
    const groups = groupMarks(marks, 20, center)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.rect).toEqual(at(15, 0))
  })
})
