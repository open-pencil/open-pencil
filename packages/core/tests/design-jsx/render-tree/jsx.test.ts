import { describe, expect, it } from 'bun:test'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { getNodeOrThrow, childIdAt } from '@open-pencil/test-support/assert'
import { makeSceneGraph } from '@open-pencil/test-support/scene'

describe('renderJSX (string → scene graph)', () => {
  it('renders JSX string', async () => {
    const g = makeSceneGraph()
    const jsx = `
      <Frame name="Test" w={200} h={100} bg="#FF0000">
        <Text name="Hello" size={16} color="#000">World</Text>
      </Frame>
    `
    const [result] = await renderJSX(g, jsx)

    expect(result.name).toBe('Test')
    const node = getNodeOrThrow(g, result.id)
    expect(node.type).toBe('FRAME')
    expect(node.childIds.length).toBe(1)

    const text = getNodeOrThrow(g, childIdAt(node, 0))
    expect(text.text).toBe('World')
  })

  it('renders nested JSX', async () => {
    const g = makeSceneGraph()
    const jsx = `
      <Frame name="Card" w={320} flex="col" gap={16} p={24} bg="#FFF" rounded={16}>
        <Rectangle name="Image" w={272} h={200} bg="#E5E7EB" rounded={12} />
        <Text name="Title" size={18} weight="bold" color="#111">Card Title</Text>
        <Text name="Description" size={14} color="#6B7280">Lorem ipsum</Text>
      </Frame>
    `
    const [result] = await renderJSX(g, jsx)
    const card = getNodeOrThrow(g, result.id)

    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.childIds.length).toBe(3)
  })

  it('renders with position', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(g, '<Frame name="At" w={50} h={50} />', { x: 100, y: 200 })
    const node = getNodeOrThrow(g, result.id)

    expect(node.x).toBe(100)
    expect(node.y).toBe(200)
  })

  it('accepts rotation as an alias for rotate', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(g, '<Rectangle name="Rotated" w={50} h={50} rotation={15} />')
    const node = getNodeOrThrow(g, result.id)

    expect(node.rotation).toBe(15)
  })

  it('strips HTML comments before JSX parsing', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      '<Frame name="Comments" w={50} h={50}><!-- generated note --><Text color="#000">Ok</Text></Frame>'
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.name).toBe('Comments')
    expect(node.childIds.length).toBe(1)
  })

  it('warns about unsupported props', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(g, '<Frame name="Warn" w={50} h={50} mt={8} />')

    expect(result.warnings).toEqual(['Unsupported prop "mt" on <frame> is ignored.'])
  })

  it('points blur in effect helpers at radius, the name Figma uses', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `<Frame w={100} h={60} effects={[dropShadow({ x: 4, y: 4, blur: 12 }), layerBlur({ blur: 3 })]} />`
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.effects.map((effect) => effect.radius)).toEqual([8, 8])
    expect(result.warnings).toEqual([
      'Unsupported option "blur" in dropShadow() is ignored. Use "radius", the name Figma uses.',
      'Unsupported option "blur" in layerBlur() is ignored. Use "radius", the name Figma uses.'
    ])
  })

  it('warns about effect helper options it ignores', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `<Frame w={100} h={60} effects={[dropShadow({ colour: '#FF0000' }), dropShadow({ colour: '#00FF00' }), backgroundBlur({ amount: 4 })]} />`
    )

    expect(result.warnings).toEqual([
      'Unsupported option "colour" in dropShadow() is ignored. Supported options: color, x, y, offset, radius, spread, visible, blendMode, showShadowBehindNode.',
      'Unsupported option "amount" in backgroundBlur() is ignored. Supported options: radius, visible, startRadius, startOffset, endOffset.'
    ])
  })

  it('warns about paint helper options it ignores', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `<Frame w={100} h={60} fills={[solid('#FF0000', { opactiy: 0.5 }), linearGradient([['#000', 0], ['#FFF', 1]], { angle: 90 })]} />`
    )

    expect(result.warnings).toEqual([
      'Unsupported option "opactiy" in solid() is ignored. Supported options: opacity, visible, blendMode.',
      'Unsupported option "angle" in linearGradient() is ignored. Supported options: opacity, visible, blendMode, transform.'
    ])
  })

  it('only checks options objects passed to helpers', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      `<Frame w={100} h={60} effects={[layerBlur(4)]} fills={[solid('#FF0000')]} />`
    )

    expect(result.warnings).toBeUndefined()
  })

  it('accepts CSS-style layout aliases', async () => {
    const g = makeSceneGraph()
    const [result] = await renderJSX(
      g,
      '<Frame name="Aliases" w={200} h={100} flex="row" justifyContent="center" alignItems="center"><Rectangle w={20} h={20} /></Frame>'
    )
    const node = getNodeOrThrow(g, result.id)

    expect(node.primaryAxisAlign).toBe('CENTER')
    expect(node.counterAxisAlign).toBe('CENTER')
  })
})
