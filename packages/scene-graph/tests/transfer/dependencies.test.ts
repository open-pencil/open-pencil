import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Fill } from '@open-pencil/scene-graph'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'
import { layerDependencies } from '@open-pencil/scene-graph/transfer'

const RED = { r: 1, g: 0, b: 0, a: 1 }

function imagePaint(imageHash: string): Fill {
  return { type: 'IMAGE', color: RED, imageHash, imageScaleMode: 'FILL', opacity: 1, visible: true }
}

function solid(): Fill {
  return { type: 'SOLID', color: RED, opacity: 1, visible: true }
}

function fillStyle(graph: SceneGraph, id: string, props: Parameters<SceneGraph['createNode']>[2]) {
  const page = graph.addPage('Styles')
  graph.updateNode(page.id, { internalOnly: true })
  const style = graph.createNode('RECTANGLE', page.id, {
    name: id,
    sharedStyleType: 'FILL',
    internalOnly: true,
    ...props
  })
  style.source.id = id
  return style
}

describe('layerDependencies', () => {
  test('follows a bound variable through its aliases to their collections', () => {
    const graph = new SceneGraph()
    const primitives = graph.createCollection('Primitives')
    const semantic = graph.createCollection('Semantic')
    const red = graph.createVariable('red', 'COLOR', primitives.id, RED)
    const accent = graph.createVariable('accent', 'COLOR', semantic.id, { aliasId: red.id })
    graph.createVariable('unused', 'COLOR', primitives.id, RED)
    const layer = graph.createNode('RECTANGLE', graph.getPages()[0].id, { fills: [solid()] })
    graph.bindVariable(layer.id, 'fills/0/color', accent.id)

    const dependencies = layerDependencies(graph, [layer])

    expect([...dependencies.variables].sort()).toEqual([accent.id, red.id].sort())
    expect([...dependencies.collections].sort()).toEqual([primitives.id, semantic.id].sort())
  })

  test('brings a style with the variables it binds and the images it paints with', () => {
    const graph = new SceneGraph()
    const tokens = graph.createCollection('Tokens')
    const brand = graph.createVariable('brand', 'COLOR', tokens.id, RED)
    const style = fillStyle(graph, 'S:brand', { fills: [solid(), imagePaint('texture')] })
    graph.bindVariable(style.id, 'fills/0/color', brand.id)
    const layer = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      fillStyleId: 'S:brand'
    })

    const dependencies = layerDependencies(graph, [layer])

    expect(dependencies.styles.map((node) => node.id)).toEqual([style.id])
    expect([...dependencies.variables]).toEqual([brand.id])
    expect([...dependencies.images]).toEqual(['texture'])
  })

  test('counts images in strokes and vector regions, and collections a layer sets a mode of', () => {
    const graph = new SceneGraph()
    const theme = graph.createCollection('Theme')
    const layer = graph.createNode('VECTOR', graph.getPages()[0].id, {
      strokes: [{ ...imagePaint('stroke'), weight: 1, align: 'INSIDE' }],
      vectorNetwork: {
        vertices: [],
        segments: [],
        regions: [{ windingRule: 'NONZERO', loops: [], fills: [imagePaint('region')] }]
      },
      variableModes: { [theme.id]: theme.defaultModeId, missing: 'mode' }
    })

    const dependencies = layerDependencies(graph, [layer])

    expect([...dependencies.images].sort()).toEqual(['region', 'stroke'])
    expect([...dependencies.collections]).toEqual([theme.id])
  })

  test('counts images a text decoration paints with, on the layer and on its characters', () => {
    const graph = new SceneGraph()
    const text = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Link',
      textDecoration: 'UNDERLINE',
      textDecorationFills: [imagePaint('layer')],
      styleRuns: [{ start: 0, length: 2, style: { textDecorationFills: [imagePaint('run')] } }]
    })

    expect([...layerDependencies(graph, [text]).images].sort()).toEqual(['layer', 'run'])
  })

  test('includes the variables an instance binds through its overrides', () => {
    const graph = new SceneGraph()
    const tokens = graph.createCollection('Tokens')
    const accent = graph.createVariable('accent', 'COLOR', tokens.id, RED)
    const instance = graph.createNode('INSTANCE', graph.getPages()[0].id)
    setInstanceOverride(
      instance.instanceOverrides,
      instance.id,
      'label',
      'boundVariables/fills/0/color',
      accent.id
    )

    expect([...layerDependencies(graph, [instance]).variables]).toEqual([accent.id])
  })
})
