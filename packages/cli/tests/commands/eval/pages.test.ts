import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runCLI } from '#cli-tests/helpers/run'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { SceneGraph } from '@open-pencil/scene-graph'

import { loadDocument, populateWholeDocument } from '#cli/headless'

setDefaultTimeout(60_000)

/** Four pages, each with one frame holding a rectangle; returns the file and its pages' IDs. */
async function writePages() {
  const graph = new SceneGraph()
  const [first] = graph.getPages()
  first.name = 'Page 1'
  const pages = [first, ...['Page 2', 'Page 3', 'Page 4'].map((name) => graph.addPage(name))]
  for (const [index, page] of pages.entries()) {
    const frame = graph.createNode('FRAME', page.id, {
      name: `Frame ${index + 1}`,
      width: 100,
      height: 100
    })
    graph.createNode('RECTANGLE', frame.id, { name: 'Box', width: 10, height: 10 })
  }
  const path = join(await mkdtemp(join(tmpdir(), 'open-pencil-eval-pages-')), 'pages.fig')
  await Bun.write(path, (await new IORegistry(BUILTIN_IO_FORMATS).writeDocument('fig', graph)).data)
  const loaded = await loadDocument(path)
  return { path, pageIds: loaded.getPages().map((page) => page.id) }
}

/** Each page's frame, by name, with the names of the layers in it. */
async function framesByPage(path: string) {
  const graph = await loadDocument(path)
  populateWholeDocument(graph)
  return graph.getPages().map((page) =>
    graph.getChildren(page.id).map((frame) => ({
      name: frame.name,
      children: graph.getChildren(frame.id).map((child) => child.name)
    }))
  )
}

describe('eval CLI --page-id on a file', () => {
  test('runs on that page and loads the others when the script asks for them', async () => {
    const { path, pageIds } = await writePages()
    const whole = await loadDocument(path)
    populateWholeDocument(whole)
    const page4Frame = whole.getChildren(pageIds[3])[0].id

    const { stdout, exitCode, stderr } = await runCLI([
      'eval',
      path,
      '--page-id',
      pageIds[1],
      '--json',
      '--code',
      `const pages = figma.root.children
       const before = pages.map((page) => page.children.length)
       await pages[2].loadAsync()
       const byId = await figma.getNodeByIdAsync('${page4Frame}')
       return { current: figma.currentPage.name, before, frame: byId?.name, loaded: pages[3].children.length }`
    ])

    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
    expect(JSON.parse(stdout)).toEqual({
      current: 'Page 2',
      before: [1, 1, 0, 0],
      frame: 'Frame 4',
      loaded: 1
    })
  })

  test('saves the pages the script never loaded', async () => {
    const { path, pageIds } = await writePages()
    const output = join(await mkdtemp(join(tmpdir(), 'open-pencil-eval-pages-out-')), 'out.fig')

    const { exitCode } = await runCLI([
      'eval',
      path,
      '--page-id',
      pageIds[1],
      '--output',
      output,
      '--code',
      `figma.currentPage.children[0].name = 'Edited'`
    ])

    expect(exitCode).toBe(0)
    expect(await framesByPage(output)).toEqual([
      [{ name: 'Frame 1', children: ['Box'] }],
      [{ name: 'Edited', children: ['Box'] }],
      [{ name: 'Frame 3', children: ['Box'] }],
      [{ name: 'Frame 4', children: ['Box'] }]
    ])
  })

  test('rejects a page the document does not have', async () => {
    const { path } = await writePages()

    const { exitCode, stderr } = await runCLI([
      'eval',
      path,
      '--page-id',
      '9:9',
      '--code',
      'return 1'
    ])

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Page "9:9" not found')
  })
})
