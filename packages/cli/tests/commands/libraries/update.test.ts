import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CLI_ENTRY } from '#cli-tests/helpers/paths'
import * as v from 'valibot'

import { exportFigFile, parseFigFile, populateAllFigPages } from '@open-pencil/core/io/formats/fig'
import { createLibraryRevision, materializeLibraryAsset } from '@open-pencil/core/library'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'

setDefaultTimeout(60_000)

async function cli(args: string[], stdin?: string) {
  const proc = Bun.spawn([process.execPath, CLI_ENTRY, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: stdin ? Buffer.from(stdin) : undefined
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: await proc.exited }
}

function library(width: number, label: string): SceneGraph {
  const graph = new SceneGraph()
  const button = graph.createNode('COMPONENT', graph.getPages()[0].id, {
    name: 'Button',
    componentKey: 'button',
    width,
    height: 32
  })
  graph.createNode('TEXT', button.id, { name: 'Label', text: label })
  return graph
}

async function read(file: string): Promise<SceneGraph> {
  const bytes = await readFile(file)
  return parseFigFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}

/** Writes a library to its source file and reads it back, with the IDs the file gives its layers. */
async function writtenLibrary(file: string, graph: SceneGraph): Promise<SceneGraph> {
  await Bun.write(file, await exportFigFile(graph))
  const read = await parseFigFile((await readFile(file)).buffer as ArrayBuffer)
  populateAllFigPages(read)
  return read
}

function buttonOf(graph: SceneGraph) {
  const button = [...graph.getAllNodes()].find((node) => node.name === 'Button')
  if (!button) throw new Error('Expected the button')
  return button
}

const resultSchema = v.object({
  used: v.boolean(),
  current: v.boolean(),
  updatedDefinitions: v.array(v.string()),
  updatedInstances: v.array(v.string()),
  removedDefinitions: v.number()
})

describe('libraries update CLI', () => {
  test("brings a document's library components to the new revision, keeping their overrides", async () => {
    await initCodec()
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-libraries-update-'))
    const source = join(dir, 'library.fig')
    const document = join(dir, 'document.fig')

    const lib = await writtenLibrary(source, library(80, 'Old'))
    const consumer = new SceneGraph()
    const revision = await createLibraryRevision({ libraryId: 'ds', name: 'DS', graph: lib })
    const { componentId } = materializeLibraryAsset(consumer, revision, 'button')
    const instance = consumer.createInstance(componentId, consumer.getPages()[0].id, {
      name: 'Edited'
    })
    const label = instance ? consumer.getChildren(instance.id)[0] : undefined
    if (!label) throw new Error('Expected the label copy')
    consumer.updateNode(label.id, { text: 'Hello' })
    recordInstanceOverride(consumer, label.id, ['text'])
    await Bun.write(document, await exportFigFile(consumer))
    const button = buttonOf(lib)
    lib.updateNode(button.id, { width: 120 })
    lib.updateNode(lib.getChildren(button.id)[0]?.id ?? '', { text: 'New' })
    await Bun.write(source, await exportFigFile(lib))

    const update = await cli([
      'libraries',
      'update',
      document,
      '--source',
      source,
      '--write',
      '--json'
    ])
    expect(update.exitCode).toBe(0)
    const result = v.parse(v.pipe(v.string(), v.parseJson(), resultSchema), update.stdout)
    expect(result).toMatchObject({
      current: false,
      updatedDefinitions: ['button'],
      updatedInstances: [],
      removedDefinitions: 0
    })

    const updated = await read(document)
    const edited = [...updated.getAllNodes()].find((node) => node.name === 'Edited')
    expect(edited?.width).toBe(120)
    expect(updated.getChildren(edited?.id ?? '')[0]?.text).toBe('Hello')

    const again = await cli(['libraries', 'update', document, '--source', source, '--json'])
    expect(v.parse(v.pipe(v.string(), v.parseJson(), resultSchema), again.stdout).current).toBe(
      true
    )

    // A library the document does not use is not added to it.
    const saved = await readFile(document)
    const other = await cli([
      'libraries',
      'update',
      document,
      '--source',
      source,
      '--id',
      'other',
      '--write',
      '--json'
    ])
    expect(v.parse(v.pipe(v.string(), v.parseJson(), resultSchema), other.stdout).used).toBe(false)
    expect(await readFile(document)).toEqual(saved)
  })

  test('moves the instances of a component the library turns into a set of variants', async () => {
    await initCodec()
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-libraries-replace-'))
    const source = join(dir, 'library.fig')
    const document = join(dir, 'document.fig')

    const lib = await writtenLibrary(source, library(80, 'Old'))
    const consumer = new SceneGraph()
    const revision = await createLibraryRevision({ libraryId: 'ds', name: 'DS', graph: lib })
    const { componentId } = materializeLibraryAsset(consumer, revision, 'button')
    consumer.createInstance(componentId, consumer.getPages()[0].id, { name: 'Placed' })
    await Bun.write(document, await exportFigFile(consumer))
    const button = buttonOf(lib)
    const set = lib.createNode('COMPONENT_SET', lib.getPages()[0].id, {
      name: 'Button',
      componentKey: 'button'
    })
    lib.updateNode(button.id, { name: 'Size=Large', componentKey: 'button-large' })
    lib.insertChildAt(button.id, set.id, 0)
    await Bun.write(source, await exportFigFile(lib))

    const update = await cli([
      'libraries',
      'update',
      document,
      '--source',
      source,
      '--write',
      '--json'
    ])
    expect(update.exitCode).toBe(0)
    const result = v.parse(v.pipe(v.string(), v.parseJson(), resultSchema), update.stdout)
    expect(result.updatedInstances).toHaveLength(1)
    expect(result.removedDefinitions).toBe(1)

    const updated = await read(document)
    const placed = [...updated.getAllNodes()].find((node) => node.name === 'Placed')
    expect(updated.getNode(placed?.componentId ?? '')?.name).toBe('Size=Large')
  })
})
