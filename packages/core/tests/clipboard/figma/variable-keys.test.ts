import { beforeAll, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { buildFigmaClipboardHTML } from '@open-pencil/core/clipboard'
import { parseFigmaClipboard } from '@open-pencil/fig/clipboard'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

beforeAll(async () => {
  await initCodec()
})

function boundRectangle() {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Brand')
  const red = graph.createVariable('Brand/Red', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
  const rect = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    name: 'Swatch',
    fills: [
      {
        type: 'SOLID',
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL'
      }
    ],
    boundVariables: { 'fills/0/color': red.id }
  })
  return { graph, rect }
}

async function copied(graph: SceneGraph, rect: ReturnType<typeof boundRectangle>['rect']) {
  const { nodes } = expectDefined(
    await parseFigmaClipboard(expectDefined(await buildFigmaClipboardHTML([rect], graph)))
  )
  return {
    swatch: expectDefined(nodes.find((record) => record.name === 'Swatch')),
    variable: expectDefined(nodes.find((record) => record.type === 'VARIABLE')),
    collection: expectDefined(nodes.find((record) => record.type === 'VARIABLE_SET'))
  }
}

test('copies a variable made in OpenPencil by key, as Figma copies its own', async () => {
  const { graph, rect } = boundRectangle()
  const { swatch, variable, collection } = await copied(graph, rect)

  // Figma keeps a binding to a variable it knows by key as a remote variable on paste.
  const alias = expectDefined(swatch.fillPaints?.[0]?.colorVar?.value?.alias?.assetRef)
  expect([variable.key, variable.version]).toEqual([alias.key, alias.version])
  const set = expectDefined(variable.variableSetID?.assetRef)
  expect([collection.key, collection.version]).toEqual([set.key, set.version])
  expect(alias.key).toMatch(/^[0-9a-f]{40}$/)
  // The document itself is left without keys, and copying again names the variable the same.
  expect([...graph.variables.values()].every((candidate) => !candidate.key)).toBe(true)
  expect((await copied(graph, rect)).variable.key).toBe(alias.key)
})

test('an edited variable copies with a new version, which Figma reads its new value by', async () => {
  const { graph, rect } = boundRectangle()
  const first = (await copied(graph, rect)).variable
  expect((await copied(graph, rect)).variable.version).toBe(first.version)

  const [variable] = graph.variables.values()
  const collection = expectDefined(graph.variableCollections.get(variable.collectionId))
  graph.variables.set(variable.id, {
    ...variable,
    valuesByMode: { [collection.defaultModeId]: { r: 0, g: 0, b: 1, a: 1 } }
  })
  const edited = (await copied(graph, rect)).variable
  expect(edited.key).toBe(first.key)
  expect(edited.version).not.toBe(first.version)
  expect(edited.version).toMatch(/^\d+:\d+$/)
})
