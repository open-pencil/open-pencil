import { describe, expect, test } from 'bun:test'

import { exportCanvasGuides, importCanvasGuides } from '@open-pencil/fig/node-change'

const guid = { sessionID: 123, localID: 456 }

describe('Figma canvas guide conversion', () => {
  test('imports axis, owner-local offset, and binary GUID', () => {
    expect(importCanvasGuides([{ axis: 'X', offset: 42, guid }])).toEqual([
      { id: 'fig-guide:123:456', axis: 'x', position: 42, figGuid: guid }
    ])
  })

  test('rejects malformed Figma guide GUIDs', () => {
    expect(
      importCanvasGuides([{ axis: 'X', offset: 10, guid: { sessionID: 'bad', localID: null } }])
    ).toEqual([{ id: 'guide:0', axis: 'x', position: 10 }])
  })

  test('exports preserved GUID and allocates no format-specific fallback', () => {
    expect(
      exportCanvasGuides([
        { id: 'fig-guide:123:456', axis: 'y', position: 84, figGuid: guid },
        { id: 'guide:new', axis: 'x', position: 12 }
      ])
    ).toEqual([
      { axis: 'Y', offset: 84, guid },
      { axis: 'X', offset: 12 }
    ])
  })
})
