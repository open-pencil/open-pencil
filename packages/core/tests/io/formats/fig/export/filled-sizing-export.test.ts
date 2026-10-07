import { beforeAll, describe, expect, test } from 'bun:test'

import { guid } from '#core-tests/helpers/fig/guid'
import * as v from 'valibot'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, setInstanceOverride } from '@open-pencil/scene-graph'

// Figma stores fill on the child and keeps that axis fixed in the frame's own sizing; a hugging
// value there wins over the fill, so a filled row or button opened in Figma shrank to its content.

beforeAll(async () => {
  await initCodec()
})

async function exported(graph: SceneGraph) {
  const bytes = await exportFigFile(graph)
  const changes = parseFigBuffer(bytes.buffer as ArrayBuffer).nodeChanges
  return (name: string) => {
    const change = changes.find((node) => node.name === name)
    if (!change) throw new Error(`Missing ${name}`)
    return change
  }
}

describe('own sizing of frames that fill their parent', () => {
  test('a stretched row and a growing column are fixed along the axis they fill', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const card = graph.createNode('FRAME', page, {
      name: 'Card',
      layoutMode: 'VERTICAL',
      width: 320,
      height: 200
    })
    graph.createNode('FRAME', card.id, {
      name: 'Title row',
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      layoutAlignSelf: 'STRETCH'
    })
    const strip = graph.createNode('FRAME', card.id, {
      name: 'Strip',
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG'
    })
    graph.createNode('FRAME', strip.id, {
      name: 'Column',
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      layoutGrow: 1
    })

    const change = await exported(graph)
    expect(change('Title row')).toMatchObject({
      stackPrimarySizing: 'FIXED',
      stackCounterSizing: 'RESIZE_TO_FIT',
      stackChildAlignSelf: 'STRETCH'
    })
    expect(change('Column')).toMatchObject({
      stackPrimarySizing: 'RESIZE_TO_FIT',
      stackCounterSizing: 'FIXED',
      stackChildPrimaryGrow: 1
    })
  })

  test('an imported layer keeps its stored sizing until its layout is edited', async () => {
    const changes: NodeChange[] = [
      { guid: guid(1), type: 'DOCUMENT' },
      { guid: guid(2), type: 'CANVAS', parentIndex: { guid: guid(1), position: '!' } },
      {
        guid: guid(3),
        type: 'FRAME',
        name: 'Card',
        parentIndex: { guid: guid(2), position: '!' },
        stackMode: 'VERTICAL',
        stackPrimarySizing: 'FIXED',
        stackCounterSizing: 'FIXED',
        size: { x: 320, y: 200 }
      },
      {
        guid: guid(4),
        type: 'FRAME',
        name: 'Row',
        parentIndex: { guid: guid(3), position: '!' },
        stackMode: 'HORIZONTAL',
        stackPrimarySizing: 'RESIZE_TO_FIT',
        stackCounterSizing: 'RESIZE_TO_FIT',
        stackChildAlignSelf: 'STRETCH',
        size: { x: 320, y: 20 }
      }
    ]
    const { graph, sources } = materializeDocument(changes)
    expect((await exported(graph))('Row').stackPrimarySizing).toBe('RESIZE_TO_FIT')

    const row = sources.get('1:4')
    if (!row) throw new Error('Missing row')
    graph.updateNode(row, { primaryAxisSizing: 'HUG' })
    expect((await exported(graph))('Row').stackPrimarySizing).toBe('FIXED')
  })

  test('an instance stretched across its parent overrides its sizing as fixed', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const button = graph.createNode('COMPONENT', page, {
      name: 'Button',
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 272,
      height: 48
    })
    const card = graph.createNode('FRAME', page, {
      name: 'Card',
      layoutMode: 'VERTICAL',
      x: 400,
      width: 320,
      height: 200
    })
    const instance = graph.createInstance(button.id, card.id)
    if (!instance) throw new Error('Instance not created')
    graph.updateNode(instance.id, {
      name: 'Get started',
      primaryAxisSizing: 'HUG',
      layoutAlignSelf: 'STRETCH'
    })
    // The instance hugs as an override of its component, as editing it in the canvas records.
    setInstanceOverride(
      instance.instanceOverrides,
      instance.id,
      instance.id,
      'primaryAxisSizing',
      'HUG'
    )

    const change = (await exported(graph))('Get started')
    // Figma applies an instance's sizing override over its own fields, so the override decides.
    const overrides = v.parse(
      v.optional(v.array(v.looseObject({ stackPrimarySizing: v.optional(v.string()) })), []),
      Reflect.get(change.symbolData ?? {}, 'symbolOverrides')
    )
    const sizing = overrides.find((override) => override.stackPrimarySizing !== undefined)
    expect(sizing?.stackPrimarySizing).toBe('FIXED')
  })
})
