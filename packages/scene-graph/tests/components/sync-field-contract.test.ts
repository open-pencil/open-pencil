import { expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'
import { pixelLength } from '@open-pencil/scene-graph/text'

import { expectDefined } from '../helpers/assert'

for (const protectedField of ['width', 'text'] as const) {
  test(`component synchronization preserves ${protectedField} without freezing other fields`, () => {
    const graph = new SceneGraph()
    const component = graph.createNode('COMPONENT', graph.getPages()[0].id)
    const source = graph.createNode('TEXT', component.id, {
      text: 'Source',
      visible: false,
      width: 80
    })
    const instance = expectDefined(graph.createInstance(component.id, graph.getPages()[0].id))
    const clone = graph.getChildren(instance.id)[0]
    graph.updateNode(clone.id, { text: 'Override', visible: true, width: 160 })
    setInstanceOverride(instance.instanceOverrides, instance.id, clone.id, protectedField, true)
    graph.syncInstances(component.id)
    expect(clone.text).toBe(protectedField === 'text' ? 'Override' : source.text)
    expect(clone.width).toBe(protectedField === 'width' ? 160 : 80)
    expect(clone.visible).toBe(false)
  })
}

test('component synchronization updates and removes opacity bindings while preserving a claimed width binding', () => {
  const graph = new SceneGraph()
  const component = graph.createNode('COMPONENT', graph.getPages()[0].id, {
    opacity: 0.5,
    boundVariables: { opacity: 'opacity-var' }
  })
  const instance = expectDefined(graph.createInstance(component.id, graph.getPages()[0].id))
  expect(instance.opacity).toBe(0.5)
  expect(instance.boundVariables.opacity).toBe('opacity-var')
  graph.updateNode(instance.id, {
    boundVariables: { ...instance.boundVariables, width: 'width-var' }
  })
  setInstanceOverride(
    instance.instanceOverrides,
    instance.id,
    instance.id,
    'boundVariables/width',
    true
  )
  graph.updateNode(component.id, { opacity: 1, boundVariables: {} })
  graph.syncInstances(component.id)
  expect(instance.boundVariables).toEqual({ width: 'width-var' })
  expect(instance.opacity).toBe(1)
})

test('a component edit reaches every field its instances do not override, as in Figma', () => {
  // Repeats a Figma desktop 126 script: move, rotate, and restyle the component's layers.
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const card = graph.createNode('COMPONENT', page, { width: 200, height: 100 })
  const dot = graph.createNode('RECTANGLE', card.id, {
    name: 'Dot',
    x: 170,
    y: 10,
    width: 20,
    height: 20,
    horizontalConstraint: 'MAX'
  })
  const bar = graph.createNode('RECTANGLE', card.id, {
    name: 'Bar',
    x: 20,
    y: 60,
    width: 100,
    height: 10,
    strokeWeight: 1
  })
  const plain = expectDefined(graph.createInstance(card.id, page))
  const wide = expectDefined(graph.createInstance(card.id, page, { width: 300 }))
  setInstanceOverride(wide.instanceOverrides, wide.id, wide.id, 'width', 300)
  const overridden = expectDefined(graph.createInstance(card.id, page))
  const overriddenBar = graph.getChildren(overridden.id)[1]
  graph.updateNode(overriddenBar.id, { strokeWeight: 6 })
  setInstanceOverride(
    overridden.instanceOverrides,
    overridden.id,
    overriddenBar.id,
    'strokeWeight',
    6
  )

  graph.updateNode(dot.id, { x: 150, y: 30, rotation: 30 })
  graph.updateNode(bar.id, { x: 40, strokeWeight: 3, strokeAlign: 'OUTSIDE', cornerSmoothing: 0.6 })
  graph.syncInstances(card.id)

  const read = (instance: SceneNode) => {
    const [copyDot, copyBar] = graph.getChildren(instance.id)
    return {
      dot: [copyDot.x, copyDot.y, copyDot.rotation],
      bar: [copyBar.x, copyBar.strokeWeight, copyBar.strokeAlign, copyBar.cornerSmoothing]
    }
  }
  expect(read(plain)).toEqual({ dot: [150, 30, 30], bar: [40, 3, 'OUTSIDE', 0.6] })
  // A wider instance places the right-pinned dot by its constraint.
  expect(read(wide).dot).toEqual([250, 30, 30])
  expect(read(overridden).bar).toEqual([40, 6, 'OUTSIDE', 0.6])
})

test('a layer in an auto layout flow takes its place from the layout, not the component', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const row = graph.createNode('COMPONENT', page, {
    layoutMode: 'HORIZONTAL',
    width: 100,
    height: 20
  })
  const item = graph.createNode('RECTANGLE', row.id, { x: 0, y: 0, width: 20, height: 20 })
  const instance = expectDefined(graph.createInstance(row.id, page))
  const copy = graph.getChildren(instance.id)[0]
  graph.updateNode(copy.id, { x: 12 })
  graph.updateNode(item.id, { x: 30, cornerSmoothing: 0.6 })
  graph.syncInstances(row.id)
  expect([copy.x, copy.cornerSmoothing]).toEqual([12, 0.6])
})

test('restyled ranges reach instances, except one that overrides its text', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const label = graph.createNode('COMPONENT', page)
  const text = graph.createNode('TEXT', label.id, { text: 'Hello' })
  const plain = expectDefined(graph.createInstance(label.id, page))
  const instance = expectDefined(graph.createInstance(label.id, page))
  const copy = graph.getChildren(instance.id)[0]
  const runs = [{ start: 0, length: 2, style: { fontWeight: 700 } }]
  graph.updateNode(copy.id, { text: 'Hi there', styleRuns: runs })
  setInstanceOverride(instance.instanceOverrides, instance.id, copy.id, 'text', 'Hi there')
  const italic = [{ start: 0, length: 5, style: { italic: true } }]
  graph.updateNode(text.id, { styleRuns: italic })
  graph.syncInstances(label.id)
  expect(graph.getChildren(plain.id)[0].styleRuns).toEqual(italic)
  expect(copy.styleRuns).toEqual(runs)
})

/** A closed polygon through the points, as a vector network. */
function polygon(points: Array<[number, number]>): NonNullable<SceneNode['vectorNetwork']> {
  return {
    vertices: points.map(([x, y]) => ({ x, y })),
    segments: points.map((_, index) => ({
      start: index,
      end: (index + 1) % points.length,
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    })),
    regions: [{ windingRule: 'NONZERO', loops: [points.map((_, index) => index)] }]
  }
}

const corners = (network: SceneNode['vectorNetwork']) => network?.vertices.map(({ x, y }) => [x, y])

test('a path edited in a component reaches its instances, drawn at their size', () => {
  // Repeats a Figma desktop 126 script: an instance cannot override a vector's path
  // ("vector-data"), so every edit of the component's path reaches it, scaled with the layer.
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const card = graph.createNode('COMPONENT', page, { width: 200, height: 120 })
  const shape = graph.createNode('VECTOR', card.id, {
    x: 20,
    y: 20,
    width: 100,
    height: 80,
    vectorNetwork: polygon([
      [0, 0],
      [100, 0],
      [50, 80]
    ]),
    horizontalConstraint: 'SCALE',
    verticalConstraint: 'SCALE'
  })
  const plain = expectDefined(graph.createInstance(card.id, page))
  const doubled = expectDefined(graph.createInstance(card.id, page))
  // Resized as Figma's resize records it, as the instance's own size.
  graph.updateNode(doubled.id, { width: 400, height: 240 })
  for (const field of ['width', 'height'])
    setInstanceOverride(doubled.instanceOverrides, doubled.id, doubled.id, field, true)
  const copyIn = (instance: SceneNode) => graph.getChildren(instance.id)[0]

  graph.updateNode(shape.id, {
    width: 120,
    height: 90,
    vectorNetwork: polygon([
      [0, 0],
      [120, 0],
      [60, 90]
    ])
  })
  graph.syncInstances(card.id)
  expect(corners(copyIn(plain).vectorNetwork)).toEqual([
    [0, 0],
    [120, 0],
    [60, 90]
  ])
  expect([copyIn(doubled).width, copyIn(doubled).height]).toEqual([240, 180])
  expect(corners(copyIn(doubled).vectorNetwork)).toEqual([
    [0, 0],
    [240, 0],
    [120, 180]
  ])
})

test('a copy keeps its own outlines while its path matches, and drops a stale stroke outline', () => {
  // As in Figma files, a copy whose instance overrides its fill or stroke weight has outlines of
  // its own; only a changed path replaces them.
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const card = graph.createNode('COMPONENT', page, { width: 40, height: 40 })
  const outline = (byte: number) => [
    { windingRule: 'NONZERO' as const, commandsBlob: new Uint8Array([byte]) }
  ]
  const shape = graph.createNode('VECTOR', card.id, {
    width: 20,
    height: 20,
    vectorNetwork: polygon([
      [0, 0],
      [20, 0],
      [10, 20]
    ]),
    strokeGeometry: outline(1)
  })
  const instance = expectDefined(graph.createInstance(card.id, page))
  const copy = graph.getChildren(instance.id)[0]
  graph.updateNode(copy.id, {
    strokeWeight: 4,
    fillGeometry: outline(7),
    strokeGeometry: outline(8)
  })
  setInstanceOverride(instance.instanceOverrides, instance.id, copy.id, 'strokeWeight', true)

  graph.syncInstances(card.id)
  expect([...copy.fillGeometry[0].commandsBlob, ...copy.strokeGeometry[0].commandsBlob]).toEqual([
    7, 8
  ])

  graph.updateNode(shape.id, {
    vectorNetwork: polygon([
      [0, 0],
      [20, 0],
      [20, 20]
    ])
  })
  graph.syncInstances(card.id)
  expect(corners(copy.vectorNetwork)).toEqual([
    [0, 0],
    [20, 0],
    [20, 20]
  ])
  expect(copy.fillGeometry).toEqual([])
  expect(copy.strokeGeometry).toEqual([])
})

test('a component line, with no height, still reaches its instances', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const card = graph.createNode('COMPONENT', page, { width: 100, height: 40 })
  const line = graph.createNode('VECTOR', card.id, {
    y: 20,
    width: 60,
    height: 0,
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: 60, y: 0 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
  })
  const instance = expectDefined(graph.createInstance(card.id, page))
  const copy = graph.getChildren(instance.id)[0]
  graph.updateNode(line.id, {
    width: 80,
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: 80, y: 0 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
  })
  graph.syncInstances(card.id)
  expect(corners(copy.vectorNetwork)).toEqual([
    [0, 0],
    [80, 0]
  ])
})

test('a copy that sizes itself to its own content keeps that size through a component edit', () => {
  // A badge's count, as in gold-preview's lists: the instance's text is its own, the component's
  // a longer placeholder, and Figma sizes the count and its hugging frame to the instance's text.
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const badge = graph.createNode('COMPONENT', page, {
    width: 76,
    height: 18,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG'
  })
  const label = graph.createNode('FRAME', badge.id, {
    width: 60,
    height: 16,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG'
  })
  const text = graph.createNode('TEXT', label.id, {
    text: 'Badge-sm',
    width: 60,
    height: 16,
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })
  const instance = expectDefined(graph.createInstance(badge.id, page))
  const [copyLabel] = graph.getChildren(instance.id)
  const [copyText] = graph.getChildren(copyLabel.id)
  graph.updateNode(copyText.id, { text: '2', width: 8 })
  graph.updateNode(copyLabel.id, { width: 8 })
  graph.updateNode(instance.id, { width: 24 })
  setInstanceOverride(instance.instanceOverrides, instance.id, copyText.id, 'text', true)

  graph.updateNode(text.id, { width: 64, letterSpacing: pixelLength(1) })
  graph.updateNode(label.id, { width: 64 })
  graph.syncInstances(badge.id)
  expect([copyText.text, copyText.width, copyLabel.width, instance.width]).toEqual(['2', 8, 8, 24])
  expect(copyText.letterSpacing).toEqual(pixelLength(1))
})

test('content-sized copies retain their constraint anchor through live component edits', () => {
  for (const constraint of ['MIN', 'CENTER', 'MAX'] as const) {
    const graph = new SceneGraph()
    const component = graph.createNode('COMPONENT', graph.getPages()[0].id, {
      width: 100,
      height: 80
    })
    const source = graph.createNode('FRAME', component.id, {
      x: 40,
      y: 35,
      width: 20,
      height: 10,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      horizontalConstraint: constraint,
      verticalConstraint: constraint
    })
    const instance = expectDefined(graph.createInstance(component.id, graph.getPages()[0].id))
    graph.updateNode(instance.id, { width: 300, height: 160 })
    setInstanceOverride(instance.instanceOverrides, instance.id, instance.id, 'width', true)
    setInstanceOverride(instance.instanceOverrides, instance.id, instance.id, 'height', true)
    const copy = graph.getChildren(instance.id)[0]
    graph.updateNode(copy.id, { width: 10, height: 6 })
    graph.updateNode(source.id, { opacity: 0.5 })
    graph.syncInstances(component.id)
    const expected = { MIN: [40, 35], CENTER: [145, 77], MAX: [250, 119] }[constraint]
    expect([copy.x, copy.y, copy.width, copy.height]).toEqual([...expected, 10, 6])
    expect(copy.opacity).toBe(0.5)
    graph.updateNode(source.id, { x: 45, width: 40 })
    graph.syncInstances(component.id)
    const edited = { MIN: [45, 35], CENTER: [160, 77], MAX: [275, 119] }[constraint]
    expect([copy.x, copy.y]).toEqual(edited)
    graph.updateNode(instance.id, { width: 400 })
    graph.syncInstances(component.id)
    expect(copy.x).toBe(edited[0] + { MIN: 0, CENTER: 50, MAX: 100 }[constraint])
  }
})

test('anchor correction respects equal parent sizes, bound positions and auto-layout placement', () => {
  for (const mode of ['equal', 'protected', 'flow', 'fixed', 'scaled'] as const) {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', page, {
      width: 100,
      height: 80,
      layoutMode: mode === 'flow' ? 'HORIZONTAL' : 'NONE'
    })
    const source = graph.createNode('FRAME', component.id, {
      x: 40,
      y: 35,
      width: 20,
      height: 10,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: mode === 'fixed' ? 'FIXED' : 'HUG',
      counterAxisSizing: mode === 'fixed' ? 'FIXED' : 'HUG',
      horizontalConstraint: 'CENTER',
      verticalConstraint: 'CENTER'
    })
    const instance = expectDefined(graph.createInstance(component.id, page))
    const copy = graph.getChildren(instance.id)[0]
    graph.updateNode(copy.id, { x: 40, y: 35, width: 10, height: 6 })
    if (mode === 'protected') {
      graph.updateNode(copy.id, { boundVariables: { x: 'local-x', y: 'local-y' } })
      setInstanceOverride(instance.instanceOverrides, instance.id, copy.id, 'boundVariables', true)
    }
    if (mode === 'scaled') {
      graph.updateNode(instance.id, { componentScale: 2 })
      graph.updateNode(copy.id, { x: 80, y: 70, componentScale: 2 })
    }
    graph.updateNode(source.id, { opacity: 0.5 })
    graph.syncInstances(component.id)
    const expected = {
      fixed: [40, 35, 20, 10],
      scaled: [95, 77, 10, 6],
      equal: [45, 37, 10, 6],
      protected: [40, 35, 10, 6],
      flow: [40, 35, 10, 6]
    }[mode]
    expect([copy.x, copy.y, copy.width, copy.height]).toEqual(expected)
    if (mode === 'equal') {
      graph.updateNode(source.id, { horizontalConstraint: 'MAX', verticalConstraint: 'MIN' })
      graph.syncInstances(component.id)
      expect([copy.x, copy.y]).toEqual([50, 35])
    }
  }
})

test('a copy takes the component’s size once the component stops hugging its layers', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const badge = graph.createNode('COMPONENT', page, { width: 76, height: 18 })
  const label = graph.createNode('FRAME', badge.id, {
    width: 60,
    height: 16,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG'
  })
  const instance = expectDefined(graph.createInstance(badge.id, page))
  const [copyLabel] = graph.getChildren(instance.id)
  graph.updateNode(copyLabel.id, { width: 8 })

  graph.updateNode(label.id, { primaryAxisSizing: 'FIXED', width: 64 })
  graph.syncInstances(badge.id)
  expect([copyLabel.primaryAxisSizing, copyLabel.width]).toEqual(['FIXED', 64])
})

test('text a property gives a copy when its layer is linked later drops the size saved for the old text', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const button = graph.createNode('COMPONENT', page, {
    width: 80,
    height: 24,
    componentPropertyDefinitions: [{ id: 'label', name: 'Label', type: 'TEXT', defaultValue: 'Go' }]
  })
  const text = graph.createNode('TEXT', button.id, {
    text: 'Go',
    width: 20,
    height: 16,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    derivedLayout: { width: 20, height: 16 }
  })
  const instance = expectDefined(graph.createInstance(button.id, page))
  graph.updateNode(instance.id, { componentPropertyAssignments: { label: 'Checkout' } })
  const [copy] = graph.getChildren(instance.id)
  // The sizes Figma saved for the texts the component and the copy showed.
  graph.updateNode(copy.id, { derivedLayout: { width: 22, height: 16 } })

  graph.updateNode(text.id, {
    componentPropertyReferences: [{ propertyId: 'label', field: 'TEXT' }]
  })
  graph.syncInstances(button.id)
  expect([copy.text, copy.derivedLayout]).toEqual(['Checkout', null])
})

test('a text copy styled on its own keeps the size it measured, as a badge label in gold-preview', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const badge = graph.createNode('COMPONENT', page, { width: 60, height: 28 })
  const label = graph.createNode('TEXT', badge.id, {
    text: 'Badge',
    fontSize: 12,
    width: 37,
    height: 16,
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })
  const instance = expectDefined(graph.createInstance(badge.id, page))
  const [copy] = graph.getChildren(instance.id)
  graph.updateNode(copy.id, { fontSize: 14, width: 43, height: 18 })
  setInstanceOverride(instance.instanceOverrides, instance.id, copy.id, 'fontSize', true)

  graph.updateNode(label.id, { width: 38 })
  graph.syncInstances(badge.id)
  expect([copy.fontSize, copy.width, copy.height]).toEqual([14, 43, 18])
})

test('a copy that fills its parent keeps the size layout gave it', () => {
  // A stepper's icon column in gold-preview: the component shows a divider under the icon, the
  // instance hides it, and the column fills the row's height, which hugs its layers.
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const stepper = graph.createNode('COMPONENT', page, {
    width: 150,
    height: 44,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG'
  })
  const column = graph.createNode('FRAME', stepper.id, {
    width: 28,
    height: 44,
    layoutMode: 'VERTICAL',
    layoutAlignSelf: 'STRETCH'
  })
  graph.createNode('FRAME', column.id, { width: 28, height: 28 })
  graph.createNode('RECTANGLE', column.id, { width: 1, height: 11 })
  const instance = expectDefined(graph.createInstance(stepper.id, page))
  const [copyColumn] = graph.getChildren(instance.id)
  const [, copyDivider] = graph.getChildren(copyColumn.id)
  graph.updateNode(copyDivider.id, { visible: false })
  setInstanceOverride(instance.instanceOverrides, instance.id, copyDivider.id, 'visible', true)
  graph.updateNode(copyColumn.id, { height: 28 })

  graph.updateNode(column.id, { itemSpacing: 5 })
  graph.syncInstances(stepper.id)
  expect(copyColumn.height).toBe(28)
})
