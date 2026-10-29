import { beforeAll, expect, test } from 'bun:test'

import { FigmaAPI, type FigmaNodeProxy } from '@open-pencil/core/figma-api'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

beforeAll(async () => {
  await initCodec()
})

// Colors a float32 archive keeps exactly.
const red = { r: 1, g: 0, b: 0, a: 0.25 }
const blue = { r: 0, g: 0, b: 1, a: 0.5 }
const green = { r: 0, g: 0.5, b: 0, a: 0.125 }

async function reopen(graph: SceneGraph) {
  return parseFigFile((await exportFigFile(graph)).slice().buffer)
}

const guidesOf = (graph: SceneGraph) =>
  new FigmaAPI(graph).currentPage.findOne((node: FigmaNodeProxy) => node.name === 'Guides')
    ?.layoutGrids

test('layout guides set from a script or the panel save and reopen in Figma’s shape', async () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const frame = figma.createFrame()
  frame.name = 'Guides'
  frame.layoutGrids = [
    {
      pattern: 'COLUMNS',
      alignment: 'STRETCH',
      gutterSize: 20,
      count: 5,
      offset: 0,
      visible: true,
      color: red
    },
    {
      pattern: 'ROWS',
      alignment: 'MIN',
      gutterSize: 8,
      count: 3,
      sectionSize: 40,
      offset: 4,
      visible: false,
      color: blue
    },
    // Figma reports an Auto count, set as `Infinity`, as `null`.
    {
      pattern: 'COLUMNS',
      alignment: 'CENTER',
      gutterSize: 10,
      count: Infinity,
      sectionSize: 40,
      offset: 0,
      visible: true,
      color: green
    },
    { pattern: 'GRID', sectionSize: 10, visible: true, color: green }
  ]
  expect(guidesOf(await reopen(graph))).toEqual([
    {
      pattern: 'COLUMNS',
      alignment: 'STRETCH',
      gutterSize: 20,
      count: 5,
      offset: 0,
      visible: true,
      color: red
    },
    {
      pattern: 'ROWS',
      alignment: 'MIN',
      gutterSize: 8,
      count: 3,
      sectionSize: 40,
      offset: 4,
      visible: false,
      color: blue
    },
    {
      pattern: 'COLUMNS',
      alignment: 'CENTER',
      gutterSize: 10,
      count: null,
      sectionSize: 40,
      offset: 0,
      visible: true,
      color: green
    },
    { pattern: 'GRID', sectionSize: 10, visible: true, color: green }
  ])
})

test('a count edited on a guide read from a file is the count that saves', async () => {
  const graph = new SceneGraph()
  const frame = new FigmaAPI(graph).createFrame()
  frame.name = 'Guides'
  frame.layoutGrids = [
    { pattern: 'COLUMNS', alignment: 'STRETCH', gutterSize: 20, count: 5, offset: 0 }
  ]
  const opened = await reopen(graph)
  const node = [...opened.getAllNodes()].find((item) => item.name === 'Guides')
  if (!node) throw new Error('Missing frame')
  // The panel edits the count it shows, over the file's own.
  opened.updateNode(node.id, {
    layoutGrids: node.layoutGrids.map((grid) => ({ ...grid, count: 8 }))
  })
  expect(guidesOf(await reopen(opened))?.map((grid) => grid.count)).toEqual([8])
})

test('a grid saved without a size is Figma’s 10 px one', async () => {
  const graph = new SceneGraph()
  graph.createNode('FRAME', graph.getPages()[0].id, {
    name: 'Guides',
    layoutGrids: [{ pattern: 'GRID', color: blue }]
  })
  expect(guidesOf(await reopen(graph))).toEqual([
    { pattern: 'GRID', sectionSize: 10, visible: true, color: blue }
  ])
})
