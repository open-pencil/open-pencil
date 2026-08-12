import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FileSystemLibraryCatalog } from '@open-pencil/cli/library'

describe('filesystem library catalog', () => {
  test('publishes and restores revisions under a bounded root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'open-pencil-libraries-'))
    const graph = new SceneGraph()
    graph.createNode('COMPONENT', graph.getPages()[0].id, {
      name: 'Button',
      componentKey: 'button'
    })
    const catalog = new FileSystemLibraryCatalog(root)
    const revision = await catalog.publishRevision({
      libraryId: 'design-system',
      name: 'Design system',
      graph,
      publishedAt: '2026-01-01T00:00:00.000Z'
    })
    expect(await catalog.listLibraries()).toMatchObject([{ libraryId: 'design-system' }])
    expect((await catalog.getRevision('design-system')).manifest).toEqual(revision.manifest)
    expect(JSON.parse(await readFile(join(root, 'libraries.json'), 'utf8'))).toHaveLength(1)
  })
})
