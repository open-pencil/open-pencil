import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

import { getNode } from '#core/tools/read'
import { getVariableModes, setVariableMode } from '#core/tools/variables/modes'

/** A page with a frame and its child, and a Theme collection with Light and Dark modes. */
function themed() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const frame = graph.createNode('FRAME', page.id, { name: 'Screen' })
  const child = graph.createNode('RECTANGLE', frame.id, { name: 'Card' })
  const theme = graph.createCollection('Theme')
  const light = theme.defaultModeId
  graph.renameMode(theme.id, light, 'Light')
  const dark = graph.createMode(theme.id, 'Dark')
  if (!dark) throw new Error('Expected a Dark mode')
  return { graph, figma: new FigmaAPI(graph), frame, child, theme, light, dark }
}

describe('variable mode tools', () => {
  test('a frame shown in a mode by name passes it to its children', async () => {
    const { graph, figma, frame, child, theme, dark } = themed()
    expect(
      await setVariableMode.execute(figma, { ids: [frame.id], collection: 'Theme', mode: 'Dark' })
    ).toEqual({ ids: [frame.id], collection_id: theme.id, mode_id: dark, mode: 'Dark' })
    expect(graph.getNode(frame.id)?.variableModes).toEqual({ [theme.id]: dark })
    expect(graph.getNodeVariableModeId(child.id, theme.id)).toBe(dark)

    const modes = await getVariableModes.execute(figma, { id: child.id })
    expect(modes).toMatchObject({
      modes: [{ collection: 'Theme', mode_id: dark, mode: 'Dark', inherited: true }]
    })
  })

  test('the frame’s own mode shows on it, and null makes it inherit again', async () => {
    const { graph, figma, frame, theme, light, dark } = themed()
    await setVariableMode.execute(figma, { ids: [frame.id], collection: theme.id, mode: dark })
    expect(await getVariableModes.execute(figma, { id: frame.id })).toMatchObject({
      modes: [{ mode: 'Dark', inherited: false }]
    })
    expect(await getNode.execute(figma, { id: frame.id, depth: 0 })).toMatchObject({
      explicitVariableModes: { [theme.id]: dark }
    })

    await setVariableMode.execute(figma, { ids: [frame.id], collection: 'Theme', mode: null })
    expect(graph.getNode(frame.id)?.variableModes).toEqual({})
    expect(await getVariableModes.execute(figma, { id: frame.id })).toMatchObject({
      modes: [{ mode_id: light, mode: 'Light', inherited: true }]
    })
    expect(await getNode.execute(figma, { id: frame.id, depth: 0 })).not.toHaveProperty(
      'explicitVariableModes'
    )
  })

  test('an unknown collection, mode, or layer changes nothing and says what exists', async () => {
    const { graph, figma, frame } = themed()
    expect(
      await setVariableMode.execute(figma, { ids: [frame.id], collection: 'Brand', mode: 'Dark' })
    ).toEqual({ error: 'Collection "Brand" not found' })
    expect(
      await setVariableMode.execute(figma, { ids: [frame.id], collection: 'Theme', mode: 'Dim' })
    ).toEqual({ error: 'Collection "Theme" has no mode "Dim"; its modes: "Light", "Dark"' })
    expect(
      await setVariableMode.execute(figma, {
        ids: [frame.id, '0:404'],
        collection: 'Theme',
        mode: 'Dark'
      })
    ).toEqual({ error: 'Nodes not found: 0:404' })
    expect(graph.getNode(frame.id)?.variableModes).toEqual({})
  })

  test('collections that share a name are told apart by ID', async () => {
    const { graph, figma, frame } = themed()
    const other = graph.createCollection('Theme')
    const result = await setVariableMode.execute(figma, {
      ids: [frame.id],
      collection: 'Theme',
      mode: 'Dark'
    })
    expect(result).toHaveProperty('error')
    expect(JSON.stringify(result)).toContain(other.id)
  })

  test('modes that share a name are told apart by ID', async () => {
    const { graph, figma, frame, theme } = themed()
    const second = graph.createMode(theme.id, 'Dark')
    if (!second) throw new Error('Expected a second Dark mode')
    const byName = await setVariableMode.execute(figma, {
      ids: [frame.id],
      collection: 'Theme',
      mode: 'Dark'
    })
    expect(byName).toHaveProperty('error')
    expect(JSON.stringify(byName)).toContain(second)
    expect(graph.getNode(frame.id)?.variableModes).toEqual({})

    await setVariableMode.execute(figma, { ids: [frame.id], collection: 'Theme', mode: second })
    expect(graph.getNode(frame.id)?.variableModes).toEqual({ [theme.id]: second })
  })
})
