import { describe, expect, test } from 'bun:test'

import { createAPI, solidFill } from '#core-tests/helpers/figma-api'

interface SerializedNodeWithChildren {
  children?: unknown[]
}

describe('serialization', () => {
  test('toJSON returns clean object', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.name = 'Card'
    frame.resize(300, 200)
    frame.fills = [solidFill({ r: 1, g: 1, b: 1, a: 1 })]
    const json = frame.toJSON()
    expect(json.name).toBe('Card')
    expect(json.width).toBe(300)
    expect(json.fills).toBeDefined()
  })

  test('toJSON includes children', () => {
    const api = createAPI()
    const frame = api.createFrame()
    const rect = api.createRectangle()
    frame.appendChild(rect)
    const json = frame.toJSON() as SerializedNodeWithChildren
    expect(json.children).toBeDefined()
    expect(json.children?.length).toBe(1)
  })

  test('toJSON includes component properties and their layer references', () => {
    const api = createAPI()
    const component = api.createComponent()
    const definition = {
      id: 'label',
      name: 'Label',
      type: 'TEXT' as const,
      defaultValue: 'Hi'
    }
    api.graph.updateNode(component.id, { componentPropertyDefinitions: [definition] })
    const text = api.createText()
    component.appendChild(text)
    api.graph.updateNode(text.id, {
      text: 'Hi',
      componentPropertyReferences: [{ propertyId: definition.id, field: 'TEXT' }]
    })

    const json = component.toJSON() as {
      componentPropertyDefinitions?: unknown
      children?: Array<{ componentPropertyReferences?: unknown }>
    }
    expect(json.componentPropertyDefinitions).toEqual([definition])
    expect(json.children?.[0]?.componentPropertyReferences).toEqual([
      { propertyId: definition.id, field: 'TEXT' }
    ])

    const instance = api.graph.createInstance(component.id, api.currentPageId)
    if (!instance) throw new Error('Could not create a component instance')
    api.graph.updateNode(instance.id, {
      componentPropertyAssignments: { [definition.id]: 'Changed' }
    })
    expect(api.wrapNode(instance.id).toJSON()).toMatchObject({
      componentPropertyAssignments: { [definition.id]: 'Changed' }
    })
  })

  test('toString returns readable string', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.name = 'Card'
    expect(frame.toString()).toContain('FRAME')
    expect(frame.toString()).toContain('Card')
  })
})
