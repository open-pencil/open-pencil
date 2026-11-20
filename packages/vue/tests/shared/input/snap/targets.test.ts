import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

import { resolveObjectPixelSnap } from '#vue/shared/input/snap/resolve'
import { layerSnapTargets } from '#vue/shared/input/snap/targets'

describe('snap targets', () => {
  test('a layer snaps to the edges and center of the frame it sits in', () => {
    const editor = createEditor()
    editor.state.snappingPreferences = { geometry: false, objects: true, pixelGrid: true }
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      x: 100,
      y: 100,
      width: 400,
      height: 300
    })
    const box = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 50,
      y: 50,
      width: 40,
      height: 40
    })
    const moving = new Set([box.id])
    const targets = layerSnapTargets(frame.id, moving, editor)
    expect(targets.map((target) => target.id)).toEqual([frame.id])

    const nearLeft = resolveObjectPixelSnap(
      moving,
      { x: 102, y: 150, width: 40, height: 40 },
      targets,
      editor
    )
    expect(nearLeft.correction.x).toBe(-2)
    expect(nearLeft.guides.some((guide) => guide.axis === 'x' && guide.position === 100)).toBe(true)

    const nearCenter = resolveObjectPixelSnap(
      moving,
      { x: 150, y: 228, width: 40, height: 40 },
      targets,
      editor
    )
    expect(nearCenter.correction.y).toBe(2)
    expect(nearCenter.guides.some((guide) => guide.axis === 'y' && guide.position === 250)).toBe(
      true
    )
  })

  test('a layer in a group snaps to its siblings, not the group it shapes', () => {
    const editor = createEditor()
    const group = editor.graph.createNode('GROUP', editor.state.currentPageId, {
      width: 100,
      height: 100
    })
    const box = editor.graph.createNode('RECTANGLE', group.id, { width: 40, height: 40 })
    expect(layerSnapTargets(group.id, new Set([box.id]), editor)).toEqual([])
  })
})
