import { createHash } from 'node:crypto'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { SceneGraph } from '@open-pencil/scene-graph'

import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import { openAppMenu } from '#tests/helpers/menu'
import { openMappedDesign, selectedDesignSourceIds } from '#tests/helpers/storybook/mapping'

const editor = useEditorSetup('/?test')

async function designFixture() {
  const graph = new SceneGraph()
  const page = graph.addPage('Components')
  const node = graph.createNode('COMPONENT', page.id, {
    name: 'Renamed Button',
    width: 80,
    height: 40
  })
  graph.createNode('COMPONENT', page.id, { name: 'Renamed Button', width: 40, height: 40 })
  const set = graph.createNode('COMPONENT_SET', page.id, { name: 'Saved component set' })
  graph.createNode('COMPONENT', set.id, { name: 'Default' })
  const output = await new IORegistry(BUILTIN_IO_FORMATS).writeDocument('fig', graph)
  if (typeof output.data === 'string') throw new Error('Expected a binary FIG archive')
  return { data: output.data, id: node.id, setId: set.id }
}

test('implementation story availability follows saved components, instances and selection changes', async () => {
  const page = editor.page
  const fixture = await designFixture()
  await openMappedDesign(page, fixture.data, fixture.id)
  const ids = await page.evaluate((setSourceId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor not initialized')
    const selected = [...store.state.selectedIds][0]
    const component = store.graph.getNode(selected)
    const set = [...store.graph.getAllNodes()].find((node) => node.source.id === setSourceId)
    if (!component || !set) throw new Error('Saved components not found')
    const page = store.state.currentPageId
    const instance = store.graph.createNode('INSTANCE', page, { componentId: component.id })
    const rectangle = store.graph.createNode('RECTANGLE', page)
    const unsaved = store.graph.createNode('COMPONENT', page)
    return {
      component: component.id,
      set: set.id,
      instance: instance.id,
      rectangle: rectangle.id,
      unsaved: unsaved.id
    }
  }, fixture.setId)
  for (const { selected, enabled } of [
    { selected: [], enabled: false },
    { selected: [ids.rectangle], enabled: false },
    { selected: [ids.unsaved], enabled: false },
    { selected: [ids.component], enabled: true },
    { selected: [ids.component, ids.set], enabled: false },
    { selected: [ids.set], enabled: true },
    { selected: [ids.instance], enabled: true },
    { selected: [ids.rectangle], enabled: false }
  ]) {
    await page.evaluate((selected) => window.openPencil?.getStore?.().select(selected), selected)
    const menu = await openAppMenu(page, 'Edit')
    const action = menu.getByRole('menuitem', { name: 'Open implementation story…', exact: true })
    if (enabled) await expect(action).toBeEnabled()
    else await expect(action).toBeDisabled()
    await page.keyboard.press('Escape')
  }
})

test('a picked developer mapping opens the implementation story through an explicit browser link', async () => {
  const page = editor.page
  const context = page.context()
  const fixture = await designFixture()
  await context.route('https://stories.example.test/**', (route) =>
    route.fulfill({ body: '<h1>Implemented button</h1>', contentType: 'text/html' })
  )
  await openMappedDesign(page, fixture.data, fixture.id)
  const mapping = JSON.stringify({
    version: 1,
    storybook: { baseUrl: 'https://stories.example.test/' },
    components: [
      {
        key: 'button',
        design: { file: 'design/library.fig', id: fixture.id },
        implementation: { import: 'src/Button.vue', export: 'Button' },
        story: { id: 'components-button--default' }
      }
    ]
  })
  const menu = await openAppMenu(page, 'Edit')
  const chooser = page.waitForEvent('filechooser')
  await menu.getByRole('menuitem', { name: 'Open implementation story…', exact: true }).click()
  await (
    await chooser
  ).setFiles({
    name: 'openpencil.components.json',
    mimeType: 'application/json',
    buffer: Buffer.from(mapping)
  })
  const outbound = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Open story', exact: true }).click()
  const story = await outbound
  await expect(story).toHaveURL(
    'https://stories.example.test/?path=%2Fstory%2Fcomponents-button--default'
  )
  await expect(story.getByRole('heading', { name: 'Implemented button' })).toBeVisible()
  expect(await selectedDesignSourceIds(page)).toEqual([fixture.id])
})

test('a pinned design link selects its persisted FIG identity despite duplicate renamed labels', async ({
  page
}) => {
  const fixture = await designFixture()
  const revision = createHash('sha256').update(fixture.data).digest('hex')
  await page.route('https://design.example.test/library.fig', (route) =>
    route.fulfill({
      body: Buffer.from(fixture.data),
      contentType: 'application/octet-stream',
      headers: { 'access-control-allow-origin': '*' }
    })
  )
  const params = new URLSearchParams({
    file: 'https://design.example.test/library.fig',
    'node-id': fixture.id,
    revision
  })
  await page.goto(`/?test&${params}`)
  await new CanvasHelper(page).waitForInit()
  await expect.poll(() => selectedDesignSourceIds(page)).toEqual([fixture.id])
  await expect(page).not.toHaveURL(/node-id|revision=/)
})
