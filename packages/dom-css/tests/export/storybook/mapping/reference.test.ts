import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  exportComponentReference,
  validateComponentReference
} from '#dom-css/export/storybook/mapping/reference'
import { mappingArgs } from '#dom-css/export/storybook/mapping/resolve'

import { mappedFixture, REVISION } from './fixtures'

const folders: string[] = []
afterAll(() => Promise.all(folders.map((folder) => rm(folder, { recursive: true, force: true }))))

interface Reference {
  args: { size: string }
  design: { file: string; id: string; revision: string }
  parameters: { design: { type: string; url: string }[] }
  states: {
    large: {
      args: { size: string; label: string }
      design: { id: string }
      parameters: Reference['parameters']
    }
  }
}

async function loadReference(
  files: Awaited<ReturnType<typeof exportComponentReference>>
): Promise<{ default: Reference }> {
  const module = files.find((file) => file.path.endsWith('.ts'))
  if (!module) throw new Error('Expected reference module')
  const folder = await mkdtemp(join(tmpdir(), 'open-pencil-mapped-reference-'))
  folders.push(folder)
  const path = join(folder, module.path)
  await writeFile(path, module.content)
  return import(path)
}

describe('implementation reference export', () => {
  test('uses the selected variant own text and boolean defaults', () => {
    const { graph, mapping, set, small, large } = mappedFixture()
    graph.updateNode(small.id, {
      componentPropertyDefinitions: [
        { id: '12:30', name: 'Label', type: 'TEXT', defaultValue: 'Small label' },
        { id: '12:31', name: 'Icon', type: 'BOOLEAN', defaultValue: 'false' }
      ]
    })
    graph.updateNode(large.id, {
      componentPropertyDefinitions: [
        { id: '12:30', name: 'Label', type: 'TEXT', defaultValue: 'Large label' },
        { id: '12:31', name: 'Icon', type: 'BOOLEAN', defaultValue: 'true' }
      ]
    })
    const props = { '12:30': { prop: 'label' }, '12:31': { prop: 'icon' } }
    expect(mappingArgs(graph, set, small, { ...mapping, props })).toEqual({
      label: 'Small label',
      icon: false
    })
    expect(mappingArgs(graph, set, large, { ...mapping, props })).toEqual({
      label: 'Large label',
      icon: true
    })
  })
  test('emits runtime-consumable default and state references using persistent IDs', async () => {
    const { graph, config, mapping, small, large } = mappedFixture()
    const rendered: string[] = []
    const files = await exportComponentReference(graph, {
      config,
      mapping,
      revision: REVISION,
      implementationImport: './Button',
      renderDesignImage: async (id) => {
        rendered.push(id)
        return new Uint8Array([1])
      }
    })
    expect(rendered).toEqual([small.id, large.id])
    expect(files.map((file) => file.path)).toEqual([
      'button.design/default.png',
      'button.design/large.png',
      'button.design.ts'
    ])
    const loaded = await loadReference(files)
    expect(loaded.default.args).toEqual({ size: 'sm' })
    expect(loaded.default.states.large.args).toEqual({ size: 'lg', label: 'Example' })
    expect(loaded.default.design).toEqual({
      file: mapping.design.file,
      id: '12:10',
      revision: REVISION
    })
    expect(loaded.default.states.large.design.id).toBe('12:12')
    const link = new URL(loaded.default.parameters.design[0].url)
    expect(link.searchParams.get('node-id')).toBe('12:10')
    expect(link.searchParams.get('revision')).toBe(REVISION)
    expect(new URL(loaded.default.parameters.design[1].url).pathname).toEndWith(
      '/button.design/default.png'
    )
    expect(new URL(loaded.default.states.large.parameters.design[1].url).pathname).toEndWith(
      '/button.design/large.png'
    )
  })

  test('invalidates reference image URLs by saved revision while keeping filenames and bytes stable', async () => {
    const { graph, config, mapping } = mappedFixture()
    const options = {
      config,
      mapping,
      revision: REVISION,
      implementationImport: './Button',
      renderDesignImage: async () => new Uint8Array([1])
    }
    const first = await exportComponentReference(graph, options)
    expect(await exportComponentReference(graph, options)).toEqual(first)
    const changedRevision = 'b'.repeat(64)
    const changed = await exportComponentReference(graph, { ...options, revision: changedRevision })
    expect(changed.filter((file) => file.path.endsWith('.png'))).toEqual(
      first.filter((file) => file.path.endsWith('.png'))
    )
    const before = await loadReference(first)
    const after = await loadReference(changed)
    for (const reference of [before.default, before.default.states.large])
      expect(new URL(reference.parameters.design[1].url).searchParams.get('revision')).toBe(
        REVISION
      )
    for (const reference of [after.default, after.default.states.large])
      expect(new URL(reference.parameters.design[1].url).searchParams.get('revision')).toBe(
        changedRevision
      )
  })

  test('keeps artifact identity and content across renames and duplicate display names', async () => {
    const { graph, config, mapping, set, page } = mappedFixture()
    const options = { config, mapping, revision: REVISION, implementationImport: './Button' }
    const before = await exportComponentReference(graph, options)
    graph.updateNode(set.id, { name: 'Renamed' })
    graph.createNode('COMPONENT', page.id, { name: 'Renamed' })
    expect(await exportComponentReference(graph, options)).toEqual(before)
    expect(before.map((file) => file.path)).toEqual(['button.design.ts'])
  })

  test('fails on transient IDs, deleted targets, unrelated state variants and missing property values', async () => {
    const { graph, config, mapping, set, large, page } = mappedFixture()
    const options = { config, mapping, revision: REVISION, implementationImport: './Button' }
    await expect(
      exportComponentReference(graph, {
        ...options,
        mapping: { ...mapping, design: { ...mapping.design, id: set.id } }
      })
    ).rejects.toThrow('saved FIG ID')
    graph.updateNode(large.id, { parentId: page.id })
    expect(() => validateComponentReference(graph, mapping)).toThrow('not a variant')
    graph.reparentNode(large.id, set.id)
    graph.updateNode(large.id, { componentPropertyValues: { Size: 'Missing' } })
    expect(() => validateComponentReference(graph, mapping)).toThrow('no implementation value')
    graph.deleteNode(set.id)
    await expect(exportComponentReference(graph, options)).rejects.toThrow('deleted or recreated')
  })

  test('rejects stale revision pins and state args that contradict a physical variant', async () => {
    const { graph, config, mapping } = mappedFixture()
    const options = { config, mapping, revision: REVISION, implementationImport: './Button' }
    await expect(
      exportComponentReference(graph, {
        ...options,
        mapping: { ...mapping, design: { ...mapping.design, revision: 'b'.repeat(64) } }
      })
    ).rejects.toThrow('stale')
    expect(() =>
      validateComponentReference(graph, {
        ...mapping,
        states: [{ ...mapping.states[0], args: { size: 'sm' } }]
      })
    ).toThrow('disagrees')
    expect(() =>
      validateComponentReference(graph, { ...mapping, props: { '12:999': { prop: 'size' } } })
    ).toThrow('no longer exists')
  })
})
