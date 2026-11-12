import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { figThumbnailSize, writeFourPageFig } from '#cli-tests/helpers/fig'
import { runCLI } from '#cli-tests/helpers/run'

import { loadDocument, populateWholeDocument } from '#cli/headless'

setDefaultTimeout(60_000)

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
    const { path, pageIds } = await writeFourPageFig()
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

  test('saves the pages the script never loaded, and the Cover page as the thumbnail', async () => {
    const { path, pageIds } = await writeFourPageFig()
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
    // The Cover is the last page, which the script never loaded; its frame alone is 4:1.
    const { width, height } = figThumbnailSize(await readFile(output))
    expect(Math.min(width, height)).toBeGreaterThan(1)
    expect(width / height).toBeCloseTo(4, 1)
  })

  test('rejects a page the document does not have', async () => {
    const { path } = await writeFourPageFig()

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
