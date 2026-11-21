import { describe, expect, test } from 'bun:test'

import { designToJSON } from '#design-json/export'

import { SceneGraph } from '@open-pencil/scene-graph'
import { parseDataURL } from '@open-pencil/scene-graph/images'

/** A page with a frame holding a rectangle, whose fill is bound to a variable. */
function design() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const frame = graph.createNode('FRAME', page.id, { name: 'Card', x: 40, y: 20, width: 200 })
  const box = graph.createNode('RECTANGLE', frame.id, { name: 'Box', x: 10, y: 5, width: 50 })
  return { graph, page, frame, box }
}

describe('design JSON', () => {
  test('writes every field of each layer, with children nested and a box on the canvas', () => {
    const { graph, frame, box } = design()
    const json = designToJSON(graph, [frame.id])
    const [card] = json.layers
    expect(Object.keys(card).slice(0, 3)).toEqual(['id', 'type', 'name'])
    expect(card).toMatchObject({ id: frame.id, type: 'FRAME', name: 'Card', x: 40, width: 200 })
    expect(card).not.toHaveProperty('childIds')
    expect(card.children?.[0]).toMatchObject({ id: box.id, name: 'Box' })
    expect(card.children?.[0].worldBounds).toEqual({ x: 50, y: 25, width: 50, height: 100 })
    for (const field of Object.keys(graph.getNode(box.id) ?? {})) {
      if (field !== 'childIds') expect(card.children?.[0]).toHaveProperty(field)
    }
    // A field the layer leaves unset is listed as null.
    expect(card.children?.[0].booleanOperation).toBeNull()
    // Plain JSON: written as text and read back, it is unchanged.
    const text = JSON.stringify(json)
    expect(JSON.parse(text)).toEqual(json)
  })

  test('picks, omits, and limits depth', () => {
    const { graph, frame } = design()
    const [card] = designToJSON(graph, [frame.id], {
      pick: ['x', 'width', 'childIds'],
      omit: ['width'],
      depth: 0,
      worldBounds: false
    }).layers
    expect(card).toEqual({
      id: frame.id,
      type: 'FRAME',
      name: 'Card',
      x: 40,
      childIds: frame.childIds
    })
  })

  test('writes bytes as base64, as their length, or leaves them out', () => {
    const { graph, box } = design()
    const commandsBlob = new Uint8Array([1, 2, 3])
    graph.updateNode(box.id, { fillGeometry: [{ windingRule: 'NONZERO', commandsBlob }] })
    const geometry = (bytes: 'base64' | 'length' | 'omit') =>
      designToJSON(graph, [box.id], { bytes }).layers[0].fillGeometry
    expect(geometry('base64')).toEqual([
      { windingRule: 'NONZERO', commandsBlob: { byteLength: 3, base64: 'AQID' } }
    ])
    expect(geometry('length')).toEqual([
      { windingRule: 'NONZERO', commandsBlob: { byteLength: 3 } }
    ])
    expect(geometry('omit')).toEqual([{ windingRule: 'NONZERO' }])
  })

  test('gathers the variables a layer uses, those they alias, and their collection', () => {
    const { graph, box } = design()
    const collection = graph.createCollection('Brand')
    const base = graph.createVariable('blue', 'COLOR', collection.id, { r: 0, g: 0, b: 1, a: 1 })
    const primary = graph.createVariable('primary', 'COLOR', collection.id, { aliasId: base.id })
    graph.updateNode(box.id, {
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    graph.bindVariable(box.id, 'fills/0/color', primary.id)
    const json = designToJSON(graph, [box.id])
    expect(Object.keys(json.variables).sort()).toEqual([base.id, primary.id].sort())
    expect(json.variables[primary.id]).toMatchObject({ name: 'primary' })
    expect(json.variableCollections[collection.id]).toMatchObject({ name: 'Brand' })
    expect(designToJSON(graph, [box.id], { references: false }).variables).toEqual({})
  })

  test('writes the main component an instance uses once', () => {
    const { graph, page } = design()
    const component = graph.createNode('COMPONENT', page.id, { name: 'Button' })
    graph.createNode('TEXT', component.id, { name: 'Label', text: 'OK' })
    const first = graph.createInstance(component.id, page.id)
    const second = graph.createInstance(component.id, page.id)
    if (!first || !second) throw new Error('Expected instances')
    const json = designToJSON(graph, [first.id, second.id])
    expect(Object.keys(json.components)).toEqual([component.id])
    expect(json.components[component.id].children?.[0]).toMatchObject({ name: 'Label' })
  })

  test('lists the images paints draw, with or without their data', () => {
    const { graph, box } = design()
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    graph.images.set('hash', png)
    graph.updateNode(box.id, {
      fills: [
        {
          type: 'IMAGE',
          color: { r: 1, g: 1, b: 1, a: 1 },
          imageHash: 'hash',
          imageScaleMode: 'FILL',
          visible: true,
          opacity: 1
        }
      ]
    })
    const withData = designToJSON(graph, [box.id]).images.hash
    expect(withData).toMatchObject({ mimeType: 'image/png', byteLength: 8 })
    expect(parseDataURL(withData.dataURL ?? '')?.mimeType).toBe('image/png')
    expect(designToJSON(graph, [box.id], { images: 'summary' }).images.hash).toEqual({
      mimeType: 'image/png',
      byteLength: 8
    })
    expect(designToJSON(graph, [box.id], { images: 'omit' }).images).toEqual({})
  })

  test('a transform rewrites layers after their children and leaves out those it rejects', () => {
    const { graph, frame, box } = design()
    graph.updateNode(box.id, { visible: false })
    const seen: string[] = []
    const [card] = designToJSON(graph, [frame.id], {
      transform: (layer, node, { depth }) => {
        seen.push(`${node.name}:${depth}`)
        if (layer.visible === false) return null
        return { id: layer.id, type: layer.type, name: layer.name, children: layer.children }
      }
    }).layers
    expect(seen).toEqual(['Box:1', 'Card:0'])
    expect(card).toEqual({ id: frame.id, type: 'FRAME', name: 'Card', children: [] })
  })
})
