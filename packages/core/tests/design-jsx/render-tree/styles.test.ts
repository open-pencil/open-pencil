import { describe, expect, it } from 'bun:test'

import { renderTree, renderJSX } from '@open-pencil/core/design-jsx'
import {
  Frame,
  Text,
  Rectangle,
  designVar,
  dropShadow,
  innerShadow,
  layerBlur,
  linearGradient,
  solid
} from '@open-pencil/design-jsx'
import { expectDefined, getNodeOrThrow } from '@open-pencil/test-support/assert'
import { addTestColorVariable, makeSceneGraph } from '@open-pencil/test-support/scene'

describe('renderTree styles', () => {
  it('renders structured fill helpers', async () => {
    const g = makeSceneGraph()
    const result = await renderTree(
      g,
      Frame({
        name: 'Paints',
        w: 200,
        h: 100,
        fills: [
          solid('#112233'),
          linearGradient([
            ['#ffffff', 0],
            ['rgba(0, 0, 0, 0)', 1]
          ])
        ]
      })
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.fills).toHaveLength(2)
    expect(node.fills[0]?.type).toBe('SOLID')
    expect(node.fills[1]?.type).toBe('GRADIENT_LINEAR')
    expect(node.fills[1]?.gradientStops).toHaveLength(2)
  })

  it('renders structured fill helpers from JSX strings', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `<Frame name="Paints" w={200} h={100} fills={[solid('#112233'), linearGradient([['#fff', 0], ['#0000', 1]])]} />`
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.fills).toHaveLength(2)
    expect(node.fills[1]?.type).toBe('GRADIENT_LINEAR')
  })

  it('renders structured effect helpers', async () => {
    const g = makeSceneGraph()
    const result = await renderTree(
      g,
      Frame({
        name: 'Effects',
        w: 200,
        h: 100,
        effects: [
          dropShadow({ x: 0, y: 8, radius: 16 }),
          innerShadow({ color: '#ff000080' }),
          layerBlur(4)
        ]
      })
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.effects).toHaveLength(3)
    expect(node.effects[0]?.type).toBe('DROP_SHADOW')
    expect(node.effects[0]?.offset.y).toBe(8)
    expect(node.effects[1]?.type).toBe('INNER_SHADOW')
    expect(node.effects[2]?.type).toBe('LAYER_BLUR')
  })

  it('renders structured effect helpers from JSX strings', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `<Frame name="Effects" w={200} h={100} effects={[dropShadow({ x: 0, y: 8, radius: 16 }), backgroundBlur(12)]} />`
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.effects).toHaveLength(2)
    expect(node.effects[0]?.type).toBe('DROP_SHADOW')
    expect(node.effects[1]?.type).toBe('BACKGROUND_BLUR')
  })

  it('binds variable refs used as style values', async () => {
    const g = makeSceneGraph()
    g.addCollection({
      id: 'colors',
      name: 'Colors',
      modes: [{ modeId: 'light', name: 'Light' }],
      defaultModeId: 'light',
      variableIds: []
    })
    g.addVariable({
      id: 'var-bg',
      name: 'Background',
      type: 'COLOR',
      collectionId: 'colors',
      valuesByMode: { light: { r: 1, g: 0, b: 0, a: 1 } },
      description: '',
      hiddenFromPublishing: false
    })

    const result = await renderTree(
      g,
      Frame({ name: 'Bound', w: 100, h: 100, fill: designVar('Background') })
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.boundVariables['fills/0/color']).toBe('var-bg')
    expect(node.fills[0]?.type).toBe('SOLID')
  })

  it('supports explicit variable bindings for supported paths', async () => {
    const g = makeSceneGraph()
    addTestColorVariable(g, 'var-shadow', 'Shadow', { r: 0, g: 0, b: 0, a: 1 })
    addTestColorVariable(g, 'var-bg', 'Background')
    const variable = designVar('var-shadow')
    const result = await renderTree(
      g,
      Frame({
        name: 'Bound explicit',
        w: 100,
        h: 100,
        fill: '#ffffff',
        stroke: '#000000',
        bind: { 'strokes/0/color': variable, 'fills/0/color': 'var-bg' }
      })
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.boundVariables['strokes/0/color']).toBe('var-shadow')
    expect(node.boundVariables['fills/0/color']).toBe('var-bg')
  })

  it('binds variables from JSX strings', async () => {
    const g = makeSceneGraph()
    addTestColorVariable(g, 'var-bg', 'Background')
    const [result] = await renderJSX(
      g,
      `<Frame name="Bound JSX" w={100} h={100} fill={designVar('var-bg')} />`
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.boundVariables['fills/0/color']).toBe('var-bg')
    expect(node.fills[0]?.type).toBe('SOLID')
  })

  it('handles auto-layout properties', async () => {
    const g = makeSceneGraph()
    const tree = Frame({
      name: 'Flex',
      flex: 'row',
      gap: 8,
      justify: 'between',
      items: 'center',
      wrap: true
    })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.layoutMode).toBe('HORIZONTAL')
    expect(node.itemSpacing).toBe(8)
    expect(node.primaryAxisAlign).toBe('SPACE_BETWEEN')
    expect(node.counterAxisAlign).toBe('CENTER')
    expect(node.layoutWrap).toBe('WRAP')
  })

  it('justify/items without flex auto-enables auto-layout', async () => {
    const g = makeSceneGraph()
    const tree = Frame(
      { name: 'IconBtn', w: 36, h: 36, justify: 'center', items: 'center' },
      Text({ size: 16, color: '#FFFFFF', children: '★' })
    )
    const result = await renderTree(g, tree)
    const n = getNodeOrThrow(g, result.id)

    expect(n.layoutMode).toBe('VERTICAL')
    expect(n.primaryAxisAlign).toBe('CENTER')
    expect(n.counterAxisAlign).toBe('CENTER')
  })

  it('handles padding shorthands', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Padded', px: 16, py: 8, pt: 4 })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.paddingLeft).toBe(16)
    expect(node.paddingRight).toBe(16)
    expect(node.paddingBottom).toBe(8)
    expect(node.paddingTop).toBe(4) // pt overrides py
  })

  it('handles corner radius', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Rounded', rounded: 12 })
    const result = await renderTree(g, tree)
    expect(getNodeOrThrow(g, result.id).cornerRadius).toBe(12)
  })

  it('handles independent corners', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Corners', roundedTL: 8, roundedBR: 16 })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.independentCorners).toBe(true)
    expect(node.topLeftRadius).toBe(8)
    expect(node.bottomRightRadius).toBe(16)
  })

  it('handles stroke', async () => {
    const g = makeSceneGraph()
    const tree = Rectangle({ name: 'Bordered', stroke: '#000', strokeWidth: 2 })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.strokes.length).toBe(1)
    expect(expectDefined(node.strokes[0], 'first stroke').weight).toBe(2)
  })

  it('handles opacity and rotation', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Transformed', opacity: 0.5, rotate: 45 })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.opacity).toBe(0.5)
    expect(node.rotation).toBe(45)
  })

  it('handles overflow hidden (clip)', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Clipped', overflow: 'hidden' })
    const result = await renderTree(g, tree)
    expect(getNodeOrThrow(g, result.id).clipsContent).toBe(true)
  })

  it('handles hug sizing', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Hug', w: 'hug', h: 'hug', flex: 'col' })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.primaryAxisSizing).toBe('HUG')
    expect(node.counterAxisSizing).toBe('HUG')
  })

  it('handles fill sizing', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Fill', w: 'fill' })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.layoutGrow).toBe(1)
  })

  it('handles shadow effect', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Shadow', shadow: '0 4 12 rgba(0,0,0,0.1)' })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.effects.length).toBe(1)
    expect(expectDefined(node.effects[0], 'first effect').type).toBe('DROP_SHADOW')
    expect(expectDefined(node.effects[0], 'first effect').radius).toBe(12)
  })

  it('handles blur effect', async () => {
    const g = makeSceneGraph()
    const tree = Frame({ name: 'Blurred', blur: 8 })
    const result = await renderTree(g, tree)
    const node = getNodeOrThrow(g, result.id)

    expect(node.effects.length).toBe(1)
    expect(expectDefined(node.effects[0], 'first effect').type).toBe('LAYER_BLUR')
    expect(expectDefined(node.effects[0], 'first effect').radius).toBe(8)
  })
})
