import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer, patchFigArchive } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type Effect } from '@open-pencil/scene-graph'

const SHADOW: Effect = {
  type: 'DROP_SHADOW',
  color: { r: 1, g: 0, b: 0, a: 1 },
  offset: { x: 0, y: 2 },
  radius: 3,
  spread: 0,
  visible: true,
  blendMode: 'NORMAL'
}

/** A Light and Dark shadow, the Dark default, with one card in each mode. */
function elevation() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const theme = graph.createCollection('Theme')
  const light = theme.defaultModeId
  graph.addMode(theme.id, 'dark', 'Dark')
  const color = graph.createVariable('Shadow', 'COLOR', theme.id, { r: 0, g: 0, b: 0.5, a: 0.25 })
  color.valuesByMode.dark = { r: 0, g: 0, b: 0, a: 0.6 }
  const radius = graph.createVariable('Blur', 'FLOAT', theme.id, 8)
  radius.valuesByMode.dark = 24
  const card = (name: string, variableModes: Record<string, string> = {}) => {
    const node = graph.createNode('RECTANGLE', page.id, {
      name,
      width: 40,
      height: 40,
      variableModes,
      effects: [SHADOW]
    })
    graph.bindVariable(node.id, 'effects/0/color', color.id)
    graph.bindVariable(node.id, 'effects/0/radius', radius.id)
    graph.bindVariable(node.id, 'effects/0/offsetY', radius.id)
    return node
  }
  card('Light card', { [theme.id]: light })
  card('Dark card', { [theme.id]: 'dark' })
  return { graph, theme }
}

beforeAll(async () => {
  await initCodec()
})

describe('Figma export of effect variable bindings', () => {
  test('writes each bound property as an alias, with the value of the card’s mode', async () => {
    const { graph } = elevation()
    const records = parseFigBuffer(Uint8Array.from(await exportFigFile(graph)).buffer).nodeChanges
    const guid = (name: string) =>
      expectDefined(
        records.find((record) => record.type === 'VARIABLE' && record.name === name)?.guid,
        name
      )
    const effect = (name: string) =>
      expectDefined(records.find((record) => record.name === name)?.effects?.[0], name)
    const alias = (name: string, type: string) => ({
      dataType: 'ALIAS',
      resolvedDataType: type,
      value: { alias: { guid: guid(name) } }
    })

    expect(effect('Light card')).toMatchObject({
      radius: 8,
      offset: { x: 0, y: 8 },
      colorVar: alias('Shadow', 'COLOR'),
      radiusVar: alias('Blur', 'FLOAT'),
      yVar: alias('Blur', 'FLOAT')
    })
    expect(effect('Light card').color?.a).toBeCloseTo(0.25, 5)
    expect(effect('Light card')).not.toHaveProperty('spreadVar')
    expect(effect('Dark card')).toMatchObject({ radius: 24, offset: { x: 0, y: 24 } })
  })

  test('reads the aliases back and resolves the values a file saved for another mode', async () => {
    const { graph } = elevation()
    const exported = await exportFigFile(graph)
    const record = expectDefined(
      parseFigBuffer(Uint8Array.from(exported).buffer).nodeChanges.find(
        (node) => node.name === 'Dark card'
      ),
      'Dark card'
    )
    // Figma saves the default mode's values even on a layer set to another mode.
    const saved = {
      ...record,
      effects: record.effects?.map((effect) => ({ ...effect, radius: 8, offset: { x: 0, y: 8 } }))
    }
    const patched = patchFigArchive(
      Uint8Array.from(exported).buffer,
      { records: [saved], blobs: [], removed: [], replaceVariables: false },
      { thumbnailPNG: new Uint8Array(), metaJSON: '{}', images: [] }
    )

    const reopened = await parseFigFile(Uint8Array.from(patched).buffer)
    const variable = (name: string) =>
      expectDefined(
        [...reopened.variables.values()].find((candidate) => candidate.name === name),
        name
      ).id
    const dark = expectDefined(
      [...reopened.getAllNodes()].find((node) => node.name === 'Dark card'),
      'reopened Dark card'
    )

    expect(dark.boundVariables).toMatchObject({
      'effects/0/color': variable('Shadow'),
      'effects/0/radius': variable('Blur'),
      'effects/0/offsetY': variable('Blur')
    })
    expect(dark.effects[0]).toMatchObject({ radius: 24, offset: { x: 0, y: 24 } })
    expect(dark.effects[0].color.a).toBeCloseTo(0.6, 5)
  })

  test('drops an alias the document no longer binds', async () => {
    const { graph } = elevation()
    const reopened = await parseFigFile(Uint8Array.from(await exportFigFile(graph)).buffer)
    const light = expectDefined(
      [...reopened.getAllNodes()].find((node) => node.name === 'Light card'),
      'reopened Light card'
    )
    reopened.unbindVariable(light.id, 'effects/0/radius')

    const records = parseFigBuffer(
      Uint8Array.from(await exportFigFile(reopened)).buffer
    ).nodeChanges
    const effect = records.find((record) => record.name === 'Light card')?.effects?.[0]
    expect(effect).not.toHaveProperty('radiusVar')
    expect(effect).toHaveProperty('yVar')
  })
})
