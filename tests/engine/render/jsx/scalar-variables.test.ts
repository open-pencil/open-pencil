import { describe, expect, it } from 'bun:test'

import { renderJSX, renderTree } from '@open-pencil/core/design-jsx'
import { Frame, Text, Rectangle, defineVars, designVar } from '@open-pencil/design-jsx'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { addTestColorVariable, makeSceneGraph } from '#tests/helpers/scene'

function setup() {
  const graph = makeSceneGraph()
  graph.addCollection({
    id: 'spacing',
    name: 'Spacing',
    modes: [
      { modeId: 'comfortable', name: 'Comfortable' },
      { modeId: 'compact', name: 'Compact' }
    ],
    defaultModeId: 'comfortable',
    variableIds: []
  })
  graph.addVariable({
    id: 'space',
    name: 'Space/medium',
    type: 'FLOAT',
    collectionId: 'spacing',
    valuesByMode: { comfortable: 16, compact: 8 },
    description: '',
    hiddenFromPublishing: false
  })
  return { graph, token: designVar('space') }
}

describe('Design JSX scalar variables', () => {
  it('binds layout shorthands and computes Hug sizing from their values', async () => {
    const { graph, token } = setup()
    const result = await renderTree(
      graph,
      Frame({
        flex: 'col',
        w: 100,
        h: 'hug',
        gap: token,
        p: token,
        rounded: token,
        children: [Rectangle({ w: 20, h: 20 }), Rectangle({ w: 20, h: 20 })]
      })
    )
    const node = getNodeOrThrow(graph, result.id)
    expect(node.height).toBe(88)
    expect(node.itemSpacing).toBe(16)
    expect(node.boundVariables).toMatchObject({
      itemSpacing: 'space',
      paddingTop: 'space',
      paddingRight: 'space',
      paddingBottom: 'space',
      paddingLeft: 'space',
      cornerRadius: 'space'
    })
  })

  it('preserves literal longhand precedence over a bound shorthand', async () => {
    const { graph, token } = setup()
    const result = await renderTree(graph, Frame({ w: 100, h: 100, p: token, px: 4, pt: 2 }))
    const node = getNodeOrThrow(graph, result.id)
    expect([node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]).toEqual([
      2, 4, 16, 4
    ])
    expect(node.boundVariables).toEqual({ paddingBottom: 'space' })
  })

  it('preserves existing grid gap precedence with scalar bindings', async () => {
    const { graph, token } = setup()
    const result = await renderTree(
      graph,
      Frame({ grid: true, columns: 2, w: 100, h: 100, gap: token, columnGap: 3 })
    )
    const node = getNodeOrThrow(graph, result.id)
    expect(node.gridColumnGap).toBe(16)
    expect(node.gridRowGap).toBe(16)
    expect(node.boundVariables).toEqual({ gridRowGap: 'space', gridColumnGap: 'space' })
  })

  it('supports numeric fallback types, name lookup, typography, and fixed sizes', async () => {
    const { graph } = setup()
    const vars = defineVars({ space: { name: 'Space/medium', value: 16 } })
    const result = await renderTree(
      graph,
      Text({
        w: vars.space,
        size: vars.space,
        lineHeight: vars.space,
        letterSpacing: vars.space,
        children: 'A'
      })
    )
    const node = getNodeOrThrow(graph, result.id)
    expect(node.boundVariables).toMatchObject({
      width: 'space',
      fontSize: 'space',
      lineHeight: 'space',
      letterSpacing: 'space'
    })
    expect(node.fontSize).toBe(16)
  })

  it('binds through JSX strings in the agent authoring path', async () => {
    const { graph } = setup()
    const [result] = await renderJSX(
      graph,
      '<Frame w={100} h="hug" flex="col" p={designVar("space", 16)} />'
    )
    expect(result).toBeDefined()
    expect(getNodeOrThrow(graph, result.id).boundVariables.paddingTop).toBe('space')
  })

  it('inherits the parent collection mode', async () => {
    const { graph, token } = setup()
    const parent = graph.createNode('FRAME', graph.getPages()[0]?.id ?? '', {
      variableModes: { spacing: 'compact' }
    })
    const result = await renderTree(
      graph,
      Frame({ w: 100, h: 'hug', flex: 'col', p: token, children: Rectangle({ w: 20, h: 20 }) }),
      { parentId: parent.id }
    )
    const node = getNodeOrThrow(graph, result.id)
    expect(graph.resolveNumberVariableForNode(node.id, 'space')).toBe(8)
    expect(node.height).toBe(36)
  })

  it('rejects missing and nonnumeric variables instead of storing objects in numeric fields', async () => {
    const { graph } = setup()
    addTestColorVariable(graph, 'color', 'Color')
    await expect(renderTree(graph, Frame({ gap: designVar('color') }))).rejects.toThrow(
      'Expected a FLOAT variable'
    )
    await expect(renderTree(graph, Frame({ gap: designVar('missing', 16) }))).rejects.toThrow(
      'Expected a FLOAT variable'
    )
  })
})
