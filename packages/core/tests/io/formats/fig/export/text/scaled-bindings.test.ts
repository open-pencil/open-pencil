import { beforeAll, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { symbolOverridesOf } from '@open-pencil/fig/instance-overrides'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { rescaleNodeTree } from '@open-pencil/scene-graph/scaling'
import { findSharedStyle } from '@open-pencil/scene-graph/shared-styles'
import { reconcileVariableBindings } from '@open-pencil/scene-graph/variables'
import { expectDefined } from '@open-pencil/test-support/assert'
import { registerTestFont } from '@open-pencil/test-support/fonts/bundled'

import { graphOf } from '#core/figma-api/graph'

beforeAll(async () => {
  await registerTestFont()
  await initCodec()
})

function tripledText() {
  const api = new FigmaAPI(new SceneGraph())
  const graph = graphOf(api)
  const page = graph.getPages()[0]
  const collection = graph.createCollection('Scale')
  const size = graph.createVariable('Size', 'FLOAT', collection.id, 5)
  const style = api.createTextStyle()
  style.fontSize = 5
  const styleNode = expectDefined(findSharedStyle(graph, style.id, 'TEXT'), 'style')
  graph.bindVariable(styleNode.id, 'fontSize', size.id)
  const component = graph.createNode('COMPONENT', page.id, { width: 40, height: 20 })
  graph.createNode('TEXT', component.id, { text: 'Hello world', fontSize: 8 })
  const instance = expectDefined(graph.createInstance(component.id, page.id), 'instance')
  graph.updateNode(instance.id, { name: 'Tripled' })
  rescaleNodeTree(graph, instance.id, 3)
  const text = api.getNodeById(graph.getChildren(instance.id)[0].id)
  if (text?.type !== 'TEXT') {
    throw new Error('Expected the instance to hold a text')
  }
  const variable = expectDefined(api.variables.getVariableById(size.id), 'variable')
  return { graph, style, text, variable }
}

function writtenSizes(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.flatMap(writtenSizes)
  }
  if (typeof value !== 'object' || value === null) {
    return []
  }
  return Object.entries(value).flatMap(([key, field]) =>
    key === 'fontSize' && typeof field === 'number' ? [field] : writtenSizes(field)
  )
}

async function savedAndReopened(graph: SceneGraph) {
  reconcileVariableBindings(graph)
  const bytes = await exportFigFile(graph)
  const saved = expectDefined(
    parseFigBuffer(bytes.slice().buffer).nodeChanges.find((record) => record.name === 'Tripled'),
    'saved instance'
  )
  const reopened = await parseFigFile(bytes.slice().buffer)
  const instance = expectDefined(
    [...reopened.nodes.values()].find((node) => node.name === 'Tripled'),
    'reopened instance'
  )
  const text: SceneNode = reopened.getChildren(instance.id)[0]
  return { written: writtenSizes(symbolOverridesOf(saved)), text }
}

test('a scaled instance text on a bound style saves its size in component space', async () => {
  const { graph, style, text } = tripledText()
  text.textStyleId = style.id

  const { written, text: back } = await savedAndReopened(graph)

  expect(written).toEqual([5])
  expect(back.fontSize).toBe(15)
})

test('characters binding their own size in a scaled instance save it in component space', async () => {
  const { graph, text, variable } = tripledText()
  text.setRangeBoundVariable(0, 5, 'fontSize', variable)

  const { written, text: back } = await savedAndReopened(graph)

  expect(written).toContain(5)
  expect(written).not.toContain(15)
  expect(back.styleRuns[0]?.style.fontSize).toBe(15)
})

test('characters on a bound style in a scaled instance save their size in component space', async () => {
  const { graph, style, text } = tripledText()
  text.setRangeTextStyleId(0, 5, style.id)

  const { written, text: back } = await savedAndReopened(graph)

  expect(written).toContain(5)
  expect(written).not.toContain(15)
  expect(back.styleRuns[0]?.style.fontSize).toBe(15)
})

test('a scaled instance text binding its own size saves it in component space', async () => {
  const { graph, text, variable } = tripledText()
  text.setBoundVariable('fontSize', variable)

  const { written } = await savedAndReopened(graph)

  expect(written).toEqual([5])
})
