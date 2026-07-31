import { describe, expect, test } from 'bun:test'

import { encodePathCommandsBlob } from '@open-pencil/fig/node-change'

import { createAPI } from '../helpers'

describe('vector paths', () => {
  test('exposes imported geometry as Figma SVG paths', () => {
    const api = createAPI()
    const vector = api.createVector()
    api.graph.updateNode(vector.id, {
      fillGeometry: [
        {
          windingRule: 'EVENODD',
          commandsBlob: encodePathCommandsBlob([
            { type: 'M', x: 0, y: 0 },
            { type: 'L', x: 10, y: 10 },
            { type: 'Z' }
          ])
        }
      ]
    })

    expect(vector.vectorPaths).toEqual([{ windingRule: 'EVENODD', data: 'M0 0L10 -10Z' }])
    expect(Object.isFrozen(vector.vectorPaths)).toBe(true)
    expect(Object.isFrozen(vector.vectorPaths[0])).toBe(true)
  })
})

describe('vector geometry assignment', () => {
  const TRIANGLE = 'M 50 6 L 50 70 L 18 74 Z'

  test('assigning vectorPaths sets real geometry', () => {
    const api = createAPI()
    const vector = api.createVector()

    vector.vectorPaths = [{ windingRule: 'NONZERO', data: TRIANGLE }]

    // Regression: this used to be a silent no-op, leaving a named node with
    // no geometry and no error for the caller to react to.
    const node = api.graph.getNode(vector.id)
    expect(node?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    expect(vector.vectorPaths.length).toBeGreaterThan(0)
    expect(vector.vectorPaths[0].data.length).toBeGreaterThan(5)
  })

  test('assigning multiple vectorPaths merges them into one network', () => {
    const api = createAPI()
    const vector = api.createVector()

    vector.vectorPaths = [
      { windingRule: 'NONZERO', data: TRIANGLE },
      { windingRule: 'NONZERO', data: 'M 80 6 L 80 70 L 60 74 Z' }
    ]

    const network = api.graph.getNode(vector.id)?.vectorNetwork
    expect(network?.regions.length).toBe(2)
  })

  test('assigning vectorNetwork sets geometry and rejects invalid input', () => {
    const api = createAPI()
    const vector = api.createVector()

    vector.vectorNetwork = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
    expect(api.graph.getNode(vector.id)?.vectorNetwork?.vertices.length).toBe(2)

    // Out-of-range segment indices must surface, not be swallowed.
    expect(() => {
      vector.vectorNetwork = {
        vertices: [{ x: 0, y: 0 }],
        segments: [{ start: 0, end: 9, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      }
    }).toThrow()
  })
})
