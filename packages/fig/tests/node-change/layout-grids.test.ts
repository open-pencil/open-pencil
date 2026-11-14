import { expect, test } from 'bun:test'

import { nodeChangeToProps } from '@open-pencil/fig/node-change'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { LayoutGrid } from '@open-pencil/scene-graph'

const stripes: LayoutGrid = {
  type: 'STRETCH',
  axis: 'X',
  visible: true,
  numSections: 3,
  offset: 10,
  sectionSize: 10,
  gutterSize: 20,
  color: { r: 0, g: 0, b: 1, a: 0.5 },
  pattern: 'STRIPES'
}

const gridsOf = (layoutGrids: unknown[]) =>
  nodeChangeToProps({ type: 'FRAME', layoutGrids } as NodeChange, []).layoutGrids

// Figma desktop (2026-11-14), pasting a frame whose guide record lost a field: without `type` the
// guide is dropped; without `color` it reads as transparent black.
test('a guide record without its alignment is dropped, as Figma drops it', () => {
  const { type: _type, ...untyped } = stripes
  expect(gridsOf([stripes, untyped])).toEqual([stripes])
})

test('a guide record without its color is transparent, as Figma reads it', () => {
  const { color: _color, ...uncolored } = stripes
  expect(gridsOf([uncolored])).toEqual([{ ...uncolored, color: { r: 0, g: 0, b: 0, a: 0 } }])
})
