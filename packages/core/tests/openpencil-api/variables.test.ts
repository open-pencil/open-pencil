import { expect, test } from 'bun:test'

import { OpenPencilAPI } from '@open-pencil/core/openpencil-api'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { compileScript } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

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
    openpencil.bindVariable(label, 'text', price)
    openpencil.bindVariable(label, 'visible', state)
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
    openpencil.bindVariable(label, 'text', figma.variables.getLocalVariables()[0])
    openpencil.unbindVariable(label, 'text')
    return label.id
  `)(figma)) as string
  expect(graph.getNode(id)).toMatchObject({ text: '42.50', boundVariables: {} })
  await expect(
    compileScript(`openpencil.unbindVariable(${JSON.stringify(id)}, 'text')`)(figma)
  ).rejects.toThrow('Label has no variable bound to text')
  await expect(
    compileScript(
      `openpencil.bindVariable(${JSON.stringify(id)}, 'text', figma.variables.getLocalVariables()[1]); openpencil.bindVariable(${JSON.stringify(id)}, 'fontFamily', figma.variables.getLocalVariables()[0])`
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
  const openpencil = new OpenPencilAPI(figma)
  openpencil.bindVariable(rect, 'fills/0/color', brand)
  openpencil.unbindVariable(rect, 'fills/0/color')
  expect(graph.getNode(rect.id)?.fills[0]?.color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
})
