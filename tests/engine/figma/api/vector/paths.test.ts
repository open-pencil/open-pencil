import { describe, expect, test } from 'bun:test'

import { encodePathCommandsBlob } from '@open-pencil/fig/node-change'

import { createAPI } from '../helpers'

const CURVED_PATH = 'M10 20 C20 0 40 40 50 20 Z'

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

  test('matches Figma defaults and exposes vector properties only on vectors', () => {
    const api = createAPI()
    const vector = api.createVector()
    const rectangle = api.createRectangle()

    expect(vector.vectorPaths).toEqual([])
    expect(vector.vectorNetwork).toEqual({ vertices: [], segments: [], regions: [] })
    expect(vector.handleMirroring).toBe('NONE')
    expect(Object.isFrozen(vector.vectorNetwork)).toBe(true)
    expect('vectorPaths' in rectangle).toBe(false)
    expect('vectorNetwork' in rectangle).toBe(false)
  })

  test('normalizes assigned path geometry and updates bounds like Figma', () => {
    const api = createAPI()
    const vector = api.createVector()

    vector.vectorPaths = [{ windingRule: 'EVENODD', data: CURVED_PATH }]

    expect(vector.x).toBeCloseTo(10)
    expect(vector.y).toBeCloseTo(14.2265, 3)
    expect(vector.width).toBeCloseTo(40)
    expect(vector.height).toBeCloseTo(11.547, 3)
    expect(vector.vectorPaths[0].windingRule).toBe('EVENODD')
    expect(vector.vectorNetwork.vertices[0]?.x).toBeCloseTo(0)
    expect(vector.vectorNetwork.vertices[0]?.y).toBeCloseTo(5.7735, 3)

    vector.vectorPaths = []
    expect(vector.width).toBe(0)
    expect(vector.height).toBe(0)
    expect(vector.vectorPaths).toEqual([])
    expect(vector.vectorNetwork.vertices).toEqual([])
  })

  test('preserves filled, open, and unfilled path winding semantics', () => {
    const api = createAPI()
    const vector = api.createVector()

    vector.vectorPaths = [
      { windingRule: 'EVENODD', data: 'M 0 0 L 10 0 L 0 10 Z' },
      { windingRule: 'NONZERO', data: 'M 20 20 L 30 30' },
      { windingRule: 'NONE', data: 'M 40 40 L 50 40 L 40 50 Z' }
    ]

    expect(vector.vectorPaths.map((path) => path.windingRule)).toEqual([
      'EVENODD',
      'NONZERO',
      'NONE'
    ])
    expect(vector.vectorPaths[1]?.data.endsWith('Z')).toBe(false)
    expect(vector.vectorPaths[2]?.data.endsWith('Z')).toBe(true)
    expect(vector.vectorNetwork.regions?.map((region) => region.windingRule)).toEqual([
      'EVENODD',
      'NONZERO'
    ])
  })

  test('accepts optional regions, freezes readback, and preserves region fills', () => {
    const api = createAPI()
    const vector = api.createVector()

    vector.vectorNetwork = {
      vertices: [
        { x: 10, y: 20 },
        { x: 30, y: 20 },
        { x: 10, y: 40 }
      ],
      segments: [
        { start: 0, end: 1 },
        { start: 1, end: 2 },
        { start: 2, end: 0 }
      ],
      regions: [
        {
          windingRule: 'NONZERO',
          loops: [[0, 1, 2]],
          fills: [
            {
              type: 'SOLID',
              color: { r: 1, g: 0, b: 0, a: 1 },
              opacity: 1,
              visible: true
            }
          ]
        }
      ]
    }

    const network = vector.vectorNetwork
    expect(vector.x).toBe(10)
    expect(vector.y).toBe(20)
    expect(network.regions?.[0]?.fills?.[0]?.color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
    expect(Object.isFrozen(network.vertices)).toBe(true)
    expect(Object.isFrozen(network.vertices[0])).toBe(true)
    expect(Object.isFrozen(network.segments[0]?.tangentStart)).toBe(true)
    expect(Object.isFrozen(network.regions?.[0]?.loops[0])).toBe(true)

    const tangentStart = { x: 2, y: 3 }
    vector.vectorNetwork = {
      vertices: [
        { x: 5, y: 6 },
        { x: 15, y: 16 }
      ],
      segments: [{ start: 0, end: 1, tangentStart }]
    }
    tangentStart.x = 99
    expect(vector.vectorNetwork.regions).toEqual([])
    expect(vector.vectorNetwork.segments[0]?.tangentStart).toEqual({ x: 2, y: 3 })
    expect(vector.vectorPaths[0]?.windingRule).toBe('NONE')
  })

  test('supports async network assignment and rejects Figma-invalid input', async () => {
    const api = createAPI()
    const vector = api.createVector()

    await vector.setVectorNetworkAsync({
      vertices: [
        { x: 5, y: 6 },
        { x: 15, y: 16 }
      ],
      segments: [{ start: 0, end: 1 }]
    })
    expect(vector.vectorNetwork.vertices).toHaveLength(2)

    vector.vectorPaths = [{ windingRule: 'NONZERO', data: 'M 0 0 L 10 10' }]
    const openPathNetwork = vector.vectorNetwork
    vector.vectorNetwork = openPathNetwork
    expect(vector.vectorPaths).toEqual([{ windingRule: 'NONZERO', data: 'M0 0L10 10' }])

    await expect(
      vector.setVectorNetworkAsync({
        vertices: [{ x: 0, y: 0 }],
        segments: [{ start: 0, end: 2 }]
      })
    ).rejects.toThrow('end index 2 out of range')

    expect(() => {
      vector.vectorNetwork = null as never
    }).toThrow('network must be an object')
    expect(() => {
      vector.vectorNetwork = {
        vertices: [{ x: 0, y: 0 }],
        segments: [{ start: 0, end: 2 }]
      }
    }).toThrow('end index 2 out of range')
    expect(() => {
      vector.vectorNetwork = {
        vertices: [{ x: 0, y: 0 }],
        segments: [],
        regions: [{ windingRule: 'NONZERO', loops: [[]] }]
      }
    }).toThrow('must contain at least one segment')
    expect(() => {
      vector.vectorNetwork = {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 }
        ],
        segments: [
          { start: 0, end: 1 },
          { start: 1, end: 2 },
          { start: 2, end: 0 }
        ],
        regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]], fills: 'red' as never }]
      }
    }).toThrow('fills must be an array')
    expect(() => {
      vector.vectorNetwork = {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 }
        ],
        segments: [
          { start: 0, end: 1 },
          { start: 1, end: 2 },
          { start: 2, end: 0 }
        ],
        regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]], fillStyleId: 42 as never }]
      }
    }).toThrow('fillStyleId must be a string')
    expect(() => {
      vector.vectorPaths = [{ windingRule: 1 as never, data: 'M 0 0 L 10 0' }]
    }).toThrow('windingRule is invalid')
    expect(() => {
      vector.vectorPaths = [{ windingRule: 'NONZERO', data: 'm 0 0 l 10 0' }]
    }).toThrow('Unsupported path command')
    expect(() => {
      vector.vectorPaths = [{ windingRule: 'NONZERO', data: 'M 0 0 L' }]
    }).toThrow('Invalid vector path')
  })

  test('matches Figma handle mirroring and mixed behavior', () => {
    const api = createAPI()
    const vector = api.createVector()

    vector.handleMirroring = 'ANGLE'
    expect(vector.handleMirroring).toBe('ANGLE')

    vector.vectorNetwork = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'ANGLE' },
        { x: 10, y: 0, handleMirroring: 'NONE' }
      ],
      segments: [{ start: 0, end: 1 }]
    }
    expect(vector.handleMirroring).toBe(api.mixed)

    vector.handleMirroring = 'ANGLE_AND_LENGTH'
    expect(vector.handleMirroring).toBe('ANGLE_AND_LENGTH')
    expect(vector.vectorNetwork.vertices.map((vertex) => vertex.handleMirroring)).toEqual([
      'ANGLE_AND_LENGTH',
      'ANGLE_AND_LENGTH'
    ])
  })
})
