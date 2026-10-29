import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

import { updateNode } from '#core/tools/modify/update'

describe('update_node', () => {
  test('does not report a size it could not set on a layer inside an instance', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    const component = figma.createComponent()
    const rect = figma.createRectangle()
    rect.resize(30, 30)
    component.appendChild(rect)
    const layer = component.createInstance().children[0]

    const result = await updateNode.execute(figma, { id: layer.id, width: 60, name: 'Badge' })

    expect(result).toEqual({ id: layer.id, updated: ['name'] })
    expect(layer.width).toBe(30)
  })

  // Figma 126: a resize to the size a layer has changes nothing; a new width fixes only the width.
  test('reports what a width-only resize changes on an auto layout frame', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    const stack = figma.createFrame()
    stack.layoutMode = 'VERTICAL'
    stack.primaryAxisSizingMode = 'AUTO'
    stack.counterAxisSizingMode = 'AUTO'
    const item = figma.createRectangle()
    item.resize(40, 20)
    stack.appendChild(item)

    const same = await updateNode.execute(figma, { id: stack.id, width: stack.width })
    expect(same).toEqual({ id: stack.id, updated: [] })
    const wider = await updateNode.execute(figma, { id: stack.id, width: stack.width + 20 })

    expect(wider).toEqual({ id: stack.id, updated: ['size', 'layoutSizingHorizontal'] })
    expect([stack.layoutSizingHorizontal, stack.layoutSizingVertical]).toEqual(['FIXED', 'HUG'])
  })

  test('reports what a width-only resize changes on an auto-width text', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    const text = figma.createText()
    text.characters = 'Label'

    const same = await updateNode.execute(figma, { id: text.id, width: text.width })
    expect(same).toEqual({ id: text.id, updated: [] })
    const wider = await updateNode.execute(figma, { id: text.id, width: text.width + 20 })

    expect(wider).toEqual({ id: text.id, updated: ['size', 'textAutoResize'] })
    expect(text.textAutoResize).toBe('HEIGHT')
  })
})
