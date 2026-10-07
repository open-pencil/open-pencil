import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import vue from '@vitejs/plugin-vue'
import { createServer, type ViteDevServer } from 'vite'

import { exportStorybook } from '@open-pencil/dom-css'
import {
  emptyBehaviour,
  SceneGraph,
  withBehaviour,
  type Behaviour,
  type ComponentPropertyReference
} from '@open-pencil/scene-graph'

import { expect, test } from '../fixtures'

const fill = (r: number, g: number, b: number) => [
  { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
]
const slot = (propertyId: string): ComponentPropertyReference[] => [
  { propertyId, field: 'SLOT_CONTENT' }
]

/** A set with a variant per value of one property, drawn by `draw`, and a behaviour. */
function controlSet(
  name: string,
  property: { name: string; values: string[] },
  behaviour: Behaviour,
  draw: (graph: SceneGraph, variantId: string, value: string) => void
): SceneGraph {
  const graph = new SceneGraph()
  const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id, {
    name,
    componentPropertyDefinitions: [
      {
        id: 'value',
        name: property.name,
        type: 'VARIANT',
        defaultValue: property.values[0] ?? '',
        variantOptions: property.values
      }
    ]
  })
  for (const value of property.values) {
    const variant = graph.createNode('COMPONENT', set.id, {
      name: `${property.name}=${value}`,
      componentPropertyValues: { [property.name]: value },
      width: 40,
      height: 22
    })
    draw(graph, variant.id, value)
  }
  graph.updateNode(set.id, { pluginData: withBehaviour(set, behaviour) })
  return graph
}

function switchGraph(): SceneGraph {
  return controlSet(
    'Switch',
    { name: 'State', values: ['Off', 'On'] },
    {
      ...emptyBehaviour('switch'),
      booleans: { value: { propertyId: 'value', on: 'On', off: 'Off' } },
      parts: { thumb: 'thumb' }
    },
    (graph, variantId, value) => {
      graph.updateNode(variantId, {
        fills: value === 'On' ? fill(0.3, 0.27, 0.9) : fill(0.8, 0.84, 0.88)
      })
      graph.createNode('FRAME', variantId, {
        name: 'Thumb',
        componentPropertyReferences: slot('thumb'),
        x: value === 'On' ? 20 : 2,
        y: 2,
        width: 18,
        height: 18,
        fills: fill(1, 1, 1)
      })
    }
  )
}

function disclosureGraph(): SceneGraph {
  return controlSet(
    'Disclosure',
    { name: 'Open', values: ['No', 'Yes'] },
    {
      ...emptyBehaviour('collapsible'),
      booleans: { open: { propertyId: 'value', on: 'Yes', off: 'No' } },
      parts: { trigger: 'trigger', content: 'content' }
    },
    (graph, variantId, value) => {
      graph.createNode('FRAME', variantId, {
        name: 'Trigger',
        componentPropertyReferences: slot('trigger'),
        width: 40,
        height: 10
      })
      if (value === 'Yes')
        graph.createNode('FRAME', variantId, {
          name: 'Content',
          componentPropertyReferences: slot('content'),
          y: 12,
          width: 40,
          height: 10,
          fills: fill(0.3, 0.27, 0.9)
        })
    }
  )
}

/**
 * Exports `graph` to Vue stories, mounts the generated component twice (as is, and disabled)
 * in a Vite app under the test's output folder, so it resolves `vue` and `reka-ui` from the
 * repository as an app would, and serves it.
 */
async function serveComponent(graph: SceneGraph, folder: string): Promise<ViteDevServer> {
  const files = await exportStorybook(graph, { framework: 'vue' })
  const component = files.find((file) => file.path.endsWith('.vue'))
  if (!component) throw new Error('No component was generated')
  await mkdir(folder, { recursive: true })
  await writeFile(join(folder, component.path), component.content)
  await writeFile(
    join(folder, 'main.ts'),
    [
      "import { createApp, h } from 'vue'",
      `import Control from './${component.path}'`,
      "createApp({ render: () => [h('div', { id: 'enabled' }, h(Control)), h('div', { id: 'disabled' }, h(Control, { disabled: true }))] }).mount('#app')"
    ].join('\n')
  )
  await writeFile(
    join(folder, 'index.html'),
    '<!doctype html><div id="app"></div><script type="module" src="/main.ts"></script>'
  )
  const server = await createServer({
    root: folder,
    configFile: false,
    logLevel: 'silent',
    plugins: [vue()],
    server: { port: 0, host: '127.0.0.1' }
  })
  await server.listen()
  return server
}

test.describe('generated Vue components in a browser', () => {
  let server: ViteDevServer | undefined
  test.afterEach(async () => {
    await server?.close()
    server = undefined
  })

  test('a switch toggles on click and its state styles move the thumb', async ({ page }, info) => {
    server = await serveComponent(switchGraph(), info.outputPath('switch'))
    await page.goto(server.resolvedUrls?.local[0] ?? '')
    const control = page.locator('#enabled').getByRole('switch')
    const thumb = page.locator('#enabled .switch__thumb')
    await expect(control).toHaveAttribute('data-state', 'unchecked')
    await expect(thumb).toHaveCSS('left', '2px')

    await control.click()
    await expect(control).toHaveAttribute('data-state', 'checked')
    await expect(thumb).toHaveCSS('left', '20px')
    await expect(control).toHaveCSS('background-color', 'rgb(77, 69, 230)')

    const disabled = page.locator('#disabled').getByRole('switch')
    await disabled.click({ force: true })
    await expect(disabled).toHaveAttribute('data-state', 'unchecked')
  })

  test('a collapsible shows its content when its trigger opens it', async ({ page }, info) => {
    server = await serveComponent(disclosureGraph(), info.outputPath('disclosure'))
    await page.goto(server.resolvedUrls?.local[0] ?? '')
    const trigger = page.locator('#enabled .disclosure__trigger')
    const content = page.locator('#enabled .disclosure__content')
    await expect(content).toBeHidden()
    await trigger.click()
    await expect(page.locator('#enabled .disclosure')).toHaveAttribute('data-state', 'open')
    await expect(content).toBeVisible()
    await expect(content).toHaveCSS('top', '12px')
  })
})
