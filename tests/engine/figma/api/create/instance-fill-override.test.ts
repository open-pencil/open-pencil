import { describe, expect, test } from 'bun:test'

import { overriddenFields } from '@open-pencil/scene-graph'

import { createAPI, solidFill } from '../helpers'

function overridden(api: ReturnType<typeof createAPI>, id: string): ReadonlySet<string> {
  const node = api.graph.getNode(id)
  if (!node) throw new Error(`Missing node ${id}`)
  return overriddenFields(api.graph, node)
}

describe('setting fills on an instance descendant', () => {
  test('records an instance override so the change survives resync', () => {
    const api = createAPI()
    const icon = api.createComponent()
    icon.resize(16, 16)
    icon.appendChild(api.createVector())

    const instance = icon.createInstance()
    const vector = instance.children[0]
    if (!vector) throw new Error('vector not found')
    vector.fills = [solidFill({ r: 0, g: 0, b: 1, a: 1 })]

    expect(overridden(api, vector.id).has('fills')).toBe(true)
    api.graph.syncInstances(icon.id)
    expect(vector.fills).toHaveLength(1)
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

    expect(overridden(api, instanceText.id).has('text')).toBe(true)

    text.characters = 'Updated default'
    api.graph.syncInstances(component.id)

    expect(instanceText.characters).toBe('Custom')
  })

  test('does not record an override for a node with no instance ancestor', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.fills = [solidFill({ r: 1, g: 0, b: 0, a: 1 })]

    const raw = api.graph.getNode(frame.id)
    expect(raw?.instanceOverrides.self.size ?? 0).toBe(0)
  })
})
