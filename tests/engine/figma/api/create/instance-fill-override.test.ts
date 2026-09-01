import { describe, expect, test } from 'bun:test'

import { getInstanceOverride } from '@open-pencil/scene-graph'

import { createAPI } from '../helpers'

describe('setting fills on an instance descendant', () => {
  test('records an instance override so the change survives resync', () => {
    const api = createAPI()
    const icon = api.createComponent()
    icon.resize(16, 16)

    const instance = icon.createInstance()
    const vector = api.graph.createNode('VECTOR', instance.id, { width: 16, height: 16 })
    api.graph.updateNode(vector.id, { componentId: icon.id })

    const vectorProxy = api.getNodeById(vector.id)
    if (!vectorProxy) throw new Error('vector proxy not found')
    vectorProxy.fills = [
      { type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }
    ]

    const raw = api.graph.getNode(instance.id)
    expect(
      getInstanceOverride(
        raw?.instanceOverrides ?? { self: new Map(), descendants: new Map() },
        instance.id,
        vector.id,
        'fills'
      )
    ).toBe(true)
  })

  test('preserves text edits on an instance descendant during resync', () => {
    const api = createAPI()
    const component = api.createComponent()
    const text = api.createText()
    text.characters = 'Default'
    component.appendChild(text)

    const instance = component.createInstance()
    const instanceText = instance.children[0]
    if (!instanceText) throw new Error('instance text not found')
    instanceText.characters = 'Custom'

    expect(
      getInstanceOverride(
        api.graph.getNode(instance.id)?.instanceOverrides ?? {
          self: new Map(),
          descendants: new Map()
        },
        instance.id,
        instanceText.id,
        'text'
      )
    ).toBe(true)

    text.characters = 'Updated default'
    api.graph.syncInstances(component.id)

    expect(instanceText.characters).toBe('Custom')
  })
  test('does not record an override for a node with no instance ancestor', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]

    const raw = api.graph.getNode(frame.id)
    expect(raw?.instanceOverrides.self.size ?? 0).toBe(0)
  })
})
