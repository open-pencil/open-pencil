import { beforeAll, expect, setDefaultTimeout, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { readFixtureArrayBuffer } from '#core-tests/helpers/fig/fixtures'

import { createEditor } from '@open-pencil/core'
import { buildFigmaClipboardHTML } from '@open-pencil/core/clipboard'
import { parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigmaClipboard } from '@open-pencil/fig/clipboard'
import { symbolOverridesOf } from '@open-pencil/fig/instance-overrides'
import { initCodec } from '@open-pencil/kiwi/fig/codec'

setDefaultTimeout(120_000)

beforeAll(async () => {
  await initCodec()
})

/** Fields Figma writes on a component's record and never on an instance's. */
const COMPONENT_ONLY = [
  'componentKey',
  'sourceLibraryKey',
  'publishID',
  'publishedVersion',
  'isSymbolPublishable',
  'variantPropSpecs',
  'componentPropDefs'
]

test('copied instances carry no component identity, and a rename sits where Figma reads it', async () => {
  const graph = await parseFigFile(readFixtureArrayBuffer('gold-preview.fig'), {
    populate: 'first-page'
  })
  const list = expectDefined([...graph.nodes.values()].find((node) => node.name === 'Checked List'))
  const [first] = graph.getChildren(list.id)
  createEditor({ graph }).updateNodeWithUndo(first.id, { name: 'Lists renamed' }, 'Rename')

  const html = expectDefined(await buildFigmaClipboardHTML([list], graph))
  const { nodes } = expectDefined(await parseFigmaClipboard(html))
  const instances = nodes.filter((record) => record.type === 'INSTANCE')
  expect(instances.length).toBeGreaterThan(0)
  for (const record of instances)
    expect(COMPONENT_ONLY.filter((field) => field in record)).toEqual([])

  // Figma names an instance from the override on its own path, not from its record.
  const renamed = expectDefined(instances.find((record) => record.name === 'Lists renamed'))
  const own = symbolOverridesOf(renamed).find((override) => override.guidPath?.guids?.length === 1)
  expect(own?.name).toBe('Lists renamed')
})
