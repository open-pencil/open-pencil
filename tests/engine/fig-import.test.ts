import { describe, test, expect } from 'bun:test'

import { importNodeChanges, type NodeChange } from '@open-pencil/core'

function doc(): NodeChange {
  return {
    guid: { sessionID: 0, localID: 0 },
    type: 'DOCUMENT',
    name: 'Document',
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
  } as NodeChange
}

function canvas(localID = 1): NodeChange {
  return {
    guid: { sessionID: 0, localID },
    parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
    type: 'CANVAS',
    name: 'Page 1',
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
  } as NodeChange
}

function node(type: string, localID: number, parentLocalID: number, overrides: Partial<NodeChange> = {}): NodeChange {
  return {
    guid: { sessionID: 1, localID },
    parentIndex: { guid: { sessionID: 0, localID: parentLocalID }, position: String.fromCharCode(33 + localID) },
    type,
    name: `${type}_${localID}`,
    visible: true,
    opacity: 1,
    phase: 'CREATED',
    size: { x: 100, y: 100 },
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
    ...overrides,
  } as NodeChange
}

describe('fig-import: node types', () => {
  test('ROUNDED_RECTANGLE imported as its own type', () => {
    const graph = importNodeChanges([doc(), canvas(), node('ROUNDED_RECTANGLE', 10, 1)])
    const nodes = graph.getChildren(graph.getPages()[0].id)
    expect(nodes[0].type).toBe('ROUNDED_RECTANGLE')
  })

  test('COMPONENT maps to COMPONENT', () => {
    const graph = importNodeChanges([doc(), canvas(), node('COMPONENT', 10, 1)])
    const nodes = graph.getChildren(graph.getPages()[0].id)
    expect(nodes[0].type).toBe('COMPONENT')
  })

  test('INSTANCE maps to INSTANCE', () => {
    const graph = importNodeChanges([doc(), canvas(), node('INSTANCE', 10, 1)])
    const nodes = graph.getChildren(graph.getPages()[0].id)
    expect(nodes[0].type).toBe('INSTANCE')
  })

  test('SYMBOL maps to COMPONENT', () => {
    const graph = importNodeChanges([doc(), canvas(), node('SYMBOL', 10, 1)])
    const nodes = graph.getChildren(graph.getPages()[0].id)
    expect(nodes[0].type).toBe('COMPONENT')
  })

  test('REGULAR_POLYGON maps to POLYGON', () => {
    const graph = importNodeChanges([doc(), canvas(), node('REGULAR_POLYGON', 10, 1)])
    const nodes = graph.getChildren(graph.getPages()[0].id)
    expect(nodes[0].type).toBe('POLYGON')
  })
})

describe('fig-import: gradient fills', () => {
  test('linear gradient', () => {
    const graph = importNodeChanges([doc(), canvas(), node('RECTANGLE', 10, 1, {
      fillPaints: [{
        type: 'GRADIENT_LINEAR',
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL',
        stops: [
          { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
          { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 },
        ],
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      }] as unknown as NodeChange['fillPaints'],
    })])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.fills).toHaveLength(1)
    expect(n.fills[0].type).toBe('GRADIENT_LINEAR')
    expect(n.fills[0].gradientStops).toHaveLength(2)
    expect(n.fills[0].gradientStops![0].color.r).toBe(1)
    expect(n.fills[0].gradientStops![1].color.b).toBe(1)
    expect(n.fills[0].gradientTransform).toBeDefined()
  })

  test('radial gradient', () => {
    const graph = importNodeChanges([doc(), canvas(), node('ELLIPSE', 10, 1, {
      fillPaints: [{
        type: 'GRADIENT_RADIAL',
        opacity: 0.8,
        visible: true,
        blendMode: 'NORMAL',
        stops: [
          { color: { r: 1, g: 1, b: 1, a: 1 }, position: 0 },
          { color: { r: 0, g: 0, b: 0, a: 1 }, position: 1 },
        ],
        transform: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 },
      }] as unknown as NodeChange['fillPaints'],
    })])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.fills[0].type).toBe('GRADIENT_RADIAL')
    expect(n.fills[0].opacity).toBe(0.8)
    expect(n.fills[0].gradientStops).toHaveLength(2)
  })
})

describe('fig-import: image fills', () => {
  test('image fill with hash', () => {
    const hash: Record<string, number> = {}
    for (let i = 0; i < 20; i++) hash[String(i)] = i + 10

    const graph = importNodeChanges([doc(), canvas(), node('RECTANGLE', 10, 1, {
      fillPaints: [{
        type: 'IMAGE',
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL',
        image: { hash, name: 'test-image' },
        imageScaleMode: 'FILL',
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      }] as unknown as NodeChange['fillPaints'],
    })])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.fills[0].type).toBe('IMAGE')
    expect(n.fills[0].imageHash).toBeDefined()
    expect(n.fills[0].imageHash!.length).toBe(40)
    expect(n.fills[0].imageScaleMode).toBe('FILL')
  })

  test('images stored on graph', () => {
    const images = new Map<string, Uint8Array>()
    images.set('abc123', new Uint8Array([1, 2, 3]))
    const graph = importNodeChanges([doc(), canvas()], [], images)
    expect(graph.images.get('abc123')).toEqual(new Uint8Array([1, 2, 3]))
  })
})

describe('fig-import: effects', () => {
  test('drop shadow', () => {
    const graph = importNodeChanges([doc(), canvas(), node('RECTANGLE', 10, 1, {
      effects: [{
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 4, y: 4 },
        radius: 8,
        spread: 0,
        visible: true,
      }] as unknown as NodeChange['effects'],
    })])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.effects).toHaveLength(1)
    expect(n.effects[0].type).toBe('DROP_SHADOW')
    expect(n.effects[0].radius).toBe(8)
    expect(n.effects[0].offset.x).toBe(4)
  })

  test('inner shadow', () => {
    const graph = importNodeChanges([doc(), canvas(), node('RECTANGLE', 10, 1, {
      effects: [{
        type: 'INNER_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.5 },
        offset: { x: 0, y: 2 },
        radius: 4,
        spread: 0,
        visible: true,
      }] as unknown as NodeChange['effects'],
    })])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.effects[0].type).toBe('INNER_SHADOW')
  })
})

describe('fig-import: stroke options', () => {
  test('stroke cap and join', () => {
    const graph = importNodeChanges([doc(), canvas(), node('VECTOR', 10, 1, {
      strokePaints: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' }],
      strokeWeight: 3,
      strokeAlign: 'CENTER',
      strokeCap: 'ROUND',
      strokeJoin: 'BEVEL',
    } as Partial<NodeChange>)])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.strokes[0].cap).toBe('ROUND')
    expect(n.strokes[0].join).toBe('BEVEL')
  })

  test('dash pattern', () => {
    const graph = importNodeChanges([doc(), canvas(), node('RECTANGLE', 10, 1, {
      strokePaints: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' }],
      strokeWeight: 2,
      strokeAlign: 'CENTER',
      dashPattern: [10, 5],
    } as unknown as Partial<NodeChange>)])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.strokes[0].dashPattern).toEqual([10, 5])
  })
})

describe('fig-import: text properties', () => {
  test('text auto resize', () => {
    const graph = importNodeChanges([doc(), canvas(), node('TEXT', 10, 1, {
      textData: { characters: 'Hello' },
      fontSize: 16,
      textAlignHorizontal: 'CENTER',
      textAutoResize: 'WIDTH_AND_HEIGHT',
    } as unknown as Partial<NodeChange>)])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(n.textAlignHorizontal).toBe('CENTER')
  })

  test('font weight mapping', () => {
    const cases = [
      ['Bold', 700],
      ['Semi Bold', 600],
      ['Light', 300],
      ['ExtraBold', 800],
      ['Black', 900],
      ['Thin', 100],
      ['Medium', 500],
      ['Regular', 400],
    ] as const

    for (const [style, expected] of cases) {
      const graph = importNodeChanges([doc(), canvas(), node('TEXT', 10, 1, {
        textData: { characters: 'X' },
        fontName: { family: 'Inter', style },
      } as unknown as Partial<NodeChange>)])
      const n = graph.getChildren(graph.getPages()[0].id)[0]
      expect(n.fontWeight).toBe(expected)
    }
  })
})

describe('fig-import: arc data', () => {
  test('partial ellipse', () => {
    const graph = importNodeChanges([doc(), canvas(), node('ELLIPSE', 10, 1, {
      arcData: {
        startingAngle: 0,
        endingAngle: Math.PI,
        innerRadius: 0,
      },
    } as unknown as Partial<NodeChange>)])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.arcData).toBeDefined()
    expect(n.arcData!.startingAngle).toBe(0)
    expect(n.arcData!.endingAngle).toBeCloseTo(Math.PI)
    expect(n.arcData!.innerRadius).toBe(0)
  })

  test('donut (inner radius)', () => {
    const graph = importNodeChanges([doc(), canvas(), node('ELLIPSE', 10, 1, {
      arcData: {
        startingAngle: 0,
        endingAngle: Math.PI * 2,
        innerRadius: 0.5,
      },
    } as unknown as Partial<NodeChange>)])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.arcData!.innerRadius).toBe(0.5)
  })
})

describe('fig-import: constraints', () => {
  test('horizontal and vertical constraints', () => {
    const graph = importNodeChanges([doc(), canvas(), node('RECTANGLE', 10, 1, {
      horizontalConstraint: 'STRETCH',
      verticalConstraint: 'CENTER',
    } as unknown as Partial<NodeChange>)])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.horizontalConstraint).toBe('STRETCH')
    expect(n.verticalConstraint).toBe('CENTER')
  })

  test('defaults to MIN', () => {
    const graph = importNodeChanges([doc(), canvas(), node('RECTANGLE', 10, 1)])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.horizontalConstraint).toBe('MIN')
    expect(n.verticalConstraint).toBe('MIN')
  })
})

describe('fig-import: blend mode', () => {
  test('node blend mode', () => {
    const graph = importNodeChanges([doc(), canvas(), node('RECTANGLE', 10, 1, {
      blendMode: 'MULTIPLY',
    } as unknown as Partial<NodeChange>)])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.blendMode).toBe('MULTIPLY')
  })

  test('defaults to PASS_THROUGH', () => {
    const graph = importNodeChanges([doc(), canvas(), node('RECTANGLE', 10, 1)])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.blendMode).toBe('PASS_THROUGH')
  })
})

describe('fig-import: independent stroke weights', () => {
  test('border weights imported', () => {
    const graph = importNodeChanges([doc(), canvas(), node('FRAME', 10, 1, {
      borderTopWeight: 2,
      borderRightWeight: 4,
      borderBottomWeight: 2,
      borderLeftWeight: 4,
      borderStrokeWeightsIndependent: true,
    } as unknown as Partial<NodeChange>)])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.borderTopWeight).toBe(2)
    expect(n.borderRightWeight).toBe(4)
    expect(n.independentStrokeWeights).toBe(true)
  })
})

describe('fig-import: multiple fills', () => {
  test('solid + gradient stacked', () => {
    const graph = importNodeChanges([doc(), canvas(), node('RECTANGLE', 10, 1, {
      fillPaints: [
        { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' },
        {
          type: 'GRADIENT_LINEAR',
          opacity: 0.5,
          visible: true,
          blendMode: 'NORMAL',
          stops: [
            { color: { r: 1, g: 1, b: 1, a: 1 }, position: 0 },
            { color: { r: 0, g: 0, b: 0, a: 0 }, position: 1 },
          ],
          transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        },
      ] as unknown as NodeChange['fillPaints'],
    })])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.fills).toHaveLength(2)
    expect(n.fills[0].type).toBe('SOLID')
    expect(n.fills[1].type).toBe('GRADIENT_LINEAR')
    expect(n.fills[1].opacity).toBe(0.5)
  })
})

describe('fig-import: component set detection', () => {
  test('FRAME with VARIANT componentPropDefs becomes COMPONENT_SET', () => {
    const changes: NodeChange[] = [
      doc(),
      canvas(),
      {
        ...node('FRAME', 10, 1),
        name: 'Button',
        componentPropDefs: [
          { id: { sessionID: 0, localID: 1 }, name: 'State', type: 'VARIANT' },
        ],
      } as unknown as NodeChange,
      { ...node('SYMBOL', 11, 1), parentIndex: { guid: { sessionID: 1, localID: 10 }, position: '!' }, name: 'State=Default' } as NodeChange,
      { ...node('SYMBOL', 12, 1), parentIndex: { guid: { sessionID: 1, localID: 10 }, position: '"' }, name: 'State=Hover' } as NodeChange,
    ]
    const graph = importNodeChanges(changes, [])
    const page = graph.getPages()[0]
    const set = graph.getChildren(page.id)[0]
    expect(set.type).toBe('COMPONENT_SET')
    expect(set.name).toBe('Button')
    const children = graph.getChildren(set.id)
    expect(children).toHaveLength(2)
    expect(children[0].type).toBe('COMPONENT')
    expect(children[1].type).toBe('COMPONENT')
  })

  test('FRAME without componentPropDefs stays FRAME', () => {
    const changes: NodeChange[] = [
      doc(),
      canvas(),
      node('FRAME', 10, 1, { name: 'Regular Frame' }),
    ]
    const graph = importNodeChanges(changes, [])
    const page = graph.getPages()[0]
    const frame = graph.getChildren(page.id)[0]
    expect(frame.type).toBe('FRAME')
  })
})
