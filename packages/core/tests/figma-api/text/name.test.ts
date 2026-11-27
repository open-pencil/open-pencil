import { beforeAll, describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'
import { registerTestFont } from '@open-pencil/test-support/fonts/bundled'

beforeAll(async () => {
  await registerTestFont()
})

async function text() {
  const api = new FigmaAPI(new SceneGraph())
  await api.loadFontAsync({ family: 'Inter', style: 'Regular' })
  return api.createText()
}

// Recorded from Figma's plugin API.
describe('text layer names in the Figma API', () => {
  test('follow the characters until the layer is named', async () => {
    const node = await text()
    expect([node.name, node.autoRename]).toEqual(['Text', true])
    node.characters = 'Hello world'
    expect(node.name).toBe('Hello world')
    node.characters = 'Line one\nLine two'
    expect(node.name).toBe('Line one Line two')
    node.characters = ''
    expect([node.name, node.autoRename]).toEqual(['Text', true])

    node.name = 'Custom'
    expect([node.name, node.autoRename]).toEqual(['Custom', false])
    node.characters = 'Changed'
    expect(node.name).toBe('Custom')

    node.autoRename = true
    expect(node.name).toBe('Changed')
    expect([node.clone().name, node.clone().autoRename]).toEqual(['Changed', true])
  })

  test('follow characters inserted and deleted', async () => {
    const node = await text()
    node.characters = 'Styled'
    node.insertCharacters(6, ' more')
    expect(node.name).toBe('Styled more')
    node.deleteCharacters(0, 3)
    expect(node.name).toBe('led more')
  })

  test('a layer named before its characters keeps the name', async () => {
    const node = await text()
    node.name = 'Pre'
    node.characters = 'After'
    expect([node.name, node.autoRename]).toEqual(['Pre', false])
  })

  test("in an instance take the component's name, whatever their own characters", async () => {
    const api = new FigmaAPI(new SceneGraph())
    await api.loadFontAsync({ family: 'Inter', style: 'Regular' })
    const component = api.createComponent()
    const label = api.createText()
    component.appendChild(label)
    label.characters = 'Submit'
    const copy = component.createInstance().children[0]
    if (copy?.type !== 'TEXT') throw new Error('instance without its text')
    label.characters = 'Click here'
    expect(copy.name).toBe('Click here')
    copy.characters = 'Custom'
    expect([copy.name, copy.autoRename]).toEqual(['Click here', true])
    label.characters = 'Again'
    expect([copy.name, copy.characters]).toEqual(['Again', 'Custom'])
  })
})
