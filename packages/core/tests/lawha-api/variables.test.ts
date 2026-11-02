import { expect, test } from 'bun:test'

import { LawhaAPI } from '@lawha/core/lawha-api'
import { FigmaAPI } from '@lawha/core/figma-api'
import { compileScript } from '@lawha/core/tools'
import { SceneGraph } from '@lawha/scene-graph'

function document() {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Copy')
  graph.createVariable('price', 'FLOAT', collection.id, 42.5)
  graph.createVariable('state', 'STRING', collection.id, 'off')
  return { graph, figma: new FigmaAPI(graph) }
}

test('scripts bind what the layer panel binds, beyond Figma’s setBoundVariable', async () => {
  const { graph, figma } = document()
  const result = await compileScript(`
    const [price, state] = figma.variables.getLocalVariables()
    const label = figma.createText()
    lawha.bindVariable(label, 'text', price)
    lawha.bindVariable(label, 'visible', state)
    return { id: label.id, figmaBinds: 'bindVariable' in figma }
  `)(figma)
  const { id, figmaBinds } = result as { id: string; figmaBinds: boolean }
  expect(figmaBinds).toBe(false)
  expect(graph.getNode(id)).toMatchObject({ text: '42.50', visible: false })
})

test('unbinding keeps the value the variable last gave, and errors name the layer', async () => {
  const { graph, figma } = document()
  const id = (await compileScript(`
    const label = figma.createText()
    label.name = 'Label'
    lawha.bindVariable(label, 'text', figma.variables.getLocalVariables()[0])
    lawha.unbindVariable(label, 'text')
    return label.id
  `)(figma)) as string
  expect(graph.getNode(id)).toMatchObject({ text: '42.50', boundVariables: {} })
  await expect(
    compileScript(`lawha.unbindVariable(${JSON.stringify(id)}, 'text')`)(figma)
  ).rejects.toThrow('Label has no variable bound to text')
  await expect(
    compileScript(
      `lawha.bindVariable(${JSON.stringify(id)}, 'text', figma.variables.getLocalVariables()[1]); lawha.bindVariable(${JSON.stringify(id)}, 'fontFamily', figma.variables.getLocalVariables()[0])`
    )(figma)
  ).rejects.toThrow('Cannot bind FLOAT variable to string field "fontFamily"')
})

test('unbinding a paint keeps the color its variable last gave it', () => {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Colors')
  const brand = graph.createVariable('brand', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
  const figma = new FigmaAPI(graph)
  const rect = figma.createRectangle()
  const black = { type: 'SOLID' as const, color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
  rect.fills = [black]
  const lawha = new LawhaAPI(figma)
  lawha.bindVariable(rect, 'fills/0/color', brand)
  lawha.unbindVariable(rect, 'fills/0/color')
  expect(graph.getNode(rect.id)?.fills[0]?.color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
})
