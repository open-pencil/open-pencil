import { describe, expect, test } from 'bun:test'

import { symbolDataOf } from '#fig/instance-overrides/types'
import type { KiwiSymbolOverridePayload } from '#fig/node-change/export/context'
import { mergeOverrides } from '#fig/node-change/export/override-claims'
import { sceneNodeToKiwi } from '#fig/node-change/index'

import { recordInstanceOverride, SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

const at = (...ids: number[]) => ({ guids: ids.map((localID) => ({ sessionID: 1, localID })) })

describe('merging symbol overrides', () => {
  test('an override at a path already claimed merges into the last claim at that path', () => {
    const overrides: KiwiSymbolOverridePayload[] = [
      { guidPath: at(1), name: 'first' },
      { guidPath: at(2), visible: false },
      { guidPath: at(1), opacity: 0.5 }
    ]

    mergeOverrides(overrides, [{ guidPath: at(1), name: 'renamed' }])

    expect(overrides).toEqual([
      { guidPath: at(1), name: 'first' },
      { guidPath: at(2), visible: false },
      { guidPath: at(1), opacity: 0.5, name: 'renamed' }
    ])
  })

  test('new paths are added, and two new overrides at one path become one', () => {
    const overrides: KiwiSymbolOverridePayload[] = [{ guidPath: at(1), name: 'kept' }]

    mergeOverrides(overrides, [
      { guidPath: at(3, 4), visible: false },
      { guidPath: at(3, 4), opacity: 0.25 },
      { name: 'no path' },
      { name: 'no path either' }
    ])

    expect(overrides).toEqual([
      { guidPath: at(1), name: 'kept' },
      { guidPath: at(3, 4), visible: false, opacity: 0.25 },
      { name: 'no path' },
      { name: 'no path either' }
    ])
  })
})

// The claims Figma wrote for the same overrides, copied from live Figma on 2026-10-10.
const FIGMA_RECT_CLAIM = {
  locked: true,
  blendMode: 'MULTIPLY',
  dashPattern: [4, 2],
  cornerRadius: 12,
  rectangleTopLeftCornerRadius: 12,
  rectangleTopRightCornerRadius: 12,
  rectangleBottomLeftCornerRadius: 12,
  rectangleBottomRightCornerRadius: 12,
  strokeWeight: 7,
  strokeAlign: 'OUTSIDE',
  strokeCap: 'ROUND',
  strokeJoin: 'BEVEL',
  cornerSmoothing: 0.5
}
const FIGMA_TEXT_CLAIM = {
  fontSize: 24,
  textAlignHorizontal: 'CENTER',
  textCase: 'UPPER',
  textDecoration: 'UNDERLINE',
  lineHeight: { value: 30, units: 'PIXELS' },
  fontName: { family: 'Inter', style: 'Bold', postscript: '' }
}

describe('override claims Figma records', () => {
  test('are written with the fields and encoding Figma uses', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, { name: 'Card' })
    graph.createNode('RECTANGLE', component.id, { name: 'Box' })
    graph.createNode('TEXT', component.id, { name: 'Label', text: 'Hello' })
    const instance = graph.createInstance(component.id, page.id)
    if (!instance) throw new Error('Missing instance')
    const [box, label] = graph.getChildren(instance.id)
    const override = (id: string, changes: Partial<SceneNode>) => {
      graph.updateNode(id, changes)
      recordInstanceOverride(graph, id, Object.keys(changes))
    }
    override(box.id, {
      locked: true,
      blendMode: 'MULTIPLY',
      dashPattern: [4, 2],
      cornerRadius: 12,
      topLeftRadius: 12,
      topRightRadius: 12,
      bottomLeftRadius: 12,
      bottomRightRadius: 12,
      strokeWeight: 7,
      strokeAlign: 'OUTSIDE',
      strokeCap: 'ROUND',
      strokeJoin: 'BEVEL',
      cornerSmoothing: 0.5
    })
    override(label.id, {
      fontSize: 24,
      fontFamily: 'Inter',
      fontWeight: 700,
      lineHeight: 30,
      textAlignHorizontal: 'CENTER',
      textCase: 'UPPER',
      textDecoration: 'UNDERLINE'
    })

    const [change] = sceneNodeToKiwi(
      graph.getNode(instance.id) ?? instance,
      { sessionID: 1, localID: 1 },
      0,
      { value: 2 },
      graph,
      []
    )
    const claims = symbolDataOf(change)?.symbolOverrides ?? []
    expect(claims).toContainEqual(expect.objectContaining(FIGMA_RECT_CLAIM))
    expect(claims).toContainEqual(expect.objectContaining(FIGMA_TEXT_CLAIM))
  })
})
