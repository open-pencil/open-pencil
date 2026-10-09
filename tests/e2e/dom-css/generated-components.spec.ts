import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import { createServer, type PluginOption, type ViteDevServer } from 'vite'

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
  draw: (graph: SceneGraph, variantId: string, value: string) => void,
  graph = new SceneGraph()
): SceneGraph {
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

function switchGraph(graph?: SceneGraph): SceneGraph {
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
    },
    graph
  )
}

/** A radio group of two radios, each labelled through the radio's text property, the first chosen. */
function radioGroupGraph(): SceneGraph {
  const graph = controlSet(
    'Radio',
    { name: 'Checked', values: ['Off', 'On'] },
    {
      ...emptyBehaviour('radio'),
      booleans: { value: { propertyId: 'value', on: 'On', off: 'Off' } }
    },
    (graph, variantId, value) => {
      graph.updateNode(variantId, {
        width: 100,
        height: 20,
        fills: value === 'On' ? fill(0.3, 0.27, 0.9) : fill(0.8, 0.84, 0.88)
      })
      graph.createNode('TEXT', variantId, {
        name: 'Label',
        text: 'Option',
        componentPropertyReferences: [{ propertyId: 'label', field: 'TEXT' }]
      })
    }
  )
  const radio = [...graph.getAllNodes()].find((node) => node.type === 'COMPONENT_SET')
  if (!radio) throw new Error('Expected the radio set')
  graph.updateNode(radio.id, {
    componentPropertyDefinitions: [
      ...radio.componentPropertyDefinitions,
      { id: 'label', name: 'Label', type: 'TEXT', defaultValue: 'Option' }
    ]
  })
  const variant = (value: string) =>
    graph.getChildren(radio.id).find((child) => child.name === `Checked=${value}`)
  const group = graph.createNode('COMPONENT', graph.getPages()[0].id, { name: 'Plan' })
  const items = graph.createNode('FRAME', group.id, {
    name: 'Items',
    componentPropertyReferences: slot('items'),
    width: 100,
    height: 50
  })
  for (const [index, label] of ['Basic', 'Pro'].entries()) {
    const main = variant(index === 0 ? 'On' : 'Off')
    if (!main) throw new Error('Expected the radio drawn on and off')
    const item = graph.createInstance(main.id, items.id, { name: 'Item', y: index * 25 })
    if (!item) throw new Error('Expected the item placed')
    graph.updateNode(item.id, {
      componentPropertyAssignments: { ...item.componentPropertyAssignments, label }
    })
  }
  graph.updateNode(group.id, {
    pluginData: withBehaviour(group, { ...emptyBehaviour('radioGroup'), parts: { items: 'items' } })
  })
  return graph
}

/** Tabs whose list holds a trigger and whose panels a panel per tab. */
function tabsGraph(): SceneGraph {
  const graph = new SceneGraph()
  const tabs = graph.createNode('COMPONENT', graph.getPages()[0].id, { name: 'Settings' })
  const list = graph.createNode('FRAME', tabs.id, {
    name: 'List',
    componentPropertyReferences: slot('list'),
    width: 160,
    height: 20
  })
  const panels = graph.createNode('FRAME', tabs.id, {
    name: 'Panels',
    componentPropertyReferences: slot('panels'),
    y: 24,
    width: 160,
    height: 40
  })
  for (const label of ['Account', 'Password']) {
    const trigger = graph.createNode('FRAME', list.id, { name: 'Trigger', width: 70, height: 20 })
    graph.createNode('TEXT', trigger.id, { name: 'Label', text: label })
    const panel = graph.createNode('FRAME', panels.id, { name: 'Panel', width: 160, height: 40 })
    graph.createNode('TEXT', panel.id, { name: 'Body', text: `${label} settings` })
  }
  graph.updateNode(tabs.id, {
    pluginData: withBehaviour(tabs, {
      ...emptyBehaviour('tabs'),
      parts: { list: 'list', panels: 'panels' }
    })
  })
  return graph
}

/** A collapsible section whose content holds a switch drawn on, with the switch's set beside it. */
function sectionGraph(): SceneGraph {
  const graph = switchGraph()
  const on = [...graph.getAllNodes()].find((node) => node.name === 'State=On')
  if (!on) throw new Error('Expected the switch drawn on')
  return controlSet(
    'Section',
    { name: 'Open', values: ['No', 'Yes'] },
    {
      ...emptyBehaviour('collapsible'),
      booleans: { open: { propertyId: 'value', on: 'Yes', off: 'No' } },
      parts: { trigger: 'trigger', content: 'content' }
    },
    (graph, variantId, value) => {
      graph.updateNode(variantId, { width: 120, height: 60 })
      graph.createNode('FRAME', variantId, {
        name: 'Trigger',
        componentPropertyReferences: slot('trigger'),
        width: 120,
        height: 20
      })
      if (value !== 'Yes') return
      const content = graph.createNode('FRAME', variantId, {
        name: 'Content',
        componentPropertyReferences: slot('content'),
        y: 24,
        width: 120,
        height: 30
      })
      graph.createInstance(on.id, content.id, { name: 'Switch' })
    },
    graph
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

type Framework = 'vue' | 'react'

/** A standalone component with a behaviour, drawn by `draw`. */
function controlComponent(
  name: string,
  behaviour: Behaviour,
  draw: (graph: SceneGraph, componentId: string) => void,
  size: { width: number; height: number }
): SceneGraph {
  const graph = new SceneGraph()
  const component = graph.createNode('COMPONENT', graph.getPages()[0].id, { name, ...size })
  draw(graph, component.id)
  graph.updateNode(component.id, { pluginData: withBehaviour(component, behaviour) })
  return graph
}

/** A slider at 60 of 0 to 100 in steps of 5. */
function sliderGraph(): SceneGraph {
  return controlComponent(
    'Volume',
    {
      ...emptyBehaviour('slider'),
      parts: { track: 'track-slot', range: 'range-slot', thumb: 'thumb-slot' },
      numbers: { value: { min: 0, max: 100, step: 5, default: 60 } }
    },
    (graph, id) => {
      const track = graph.createNode('FRAME', id, {
        name: 'Track',
        componentPropertyReferences: slot('track-slot'),
        y: 8,
        width: 200,
        height: 4,
        fills: fill(0.8, 0.84, 0.88)
      })
      graph.createNode('FRAME', track.id, {
        name: 'Range',
        componentPropertyReferences: slot('range-slot'),
        width: 120,
        height: 4,
        fills: fill(0.31, 0.27, 0.9)
      })
      graph.createNode('FRAME', id, {
        name: 'Thumb',
        componentPropertyReferences: slot('thumb-slot'),
        x: 110,
        width: 20,
        height: 20,
        fills: fill(1, 1, 1)
      })
    },
    { width: 200, height: 20 }
  )
}

/** A number field at 9 of 1 to 10, between its steppers. */
function numberFieldGraph(): SceneGraph {
  const graph = controlComponent(
    'Quantity',
    {
      ...emptyBehaviour('numberField'),
      texts: { text: { propertyId: 'count' } },
      parts: { decrement: 'decrement-slot', increment: 'increment-slot' },
      numbers: { value: { min: 1, max: 10, step: 1, default: 9 } }
    },
    (graph, id) => {
      graph.updateNode(id, {
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        itemSpacing: 8
      })
      const stepper = (name: string, property: string) =>
        graph.createNode('FRAME', id, {
          name,
          componentPropertyReferences: slot(property),
          width: 24,
          height: 24,
          fills: fill(0.8, 0.84, 0.88)
        })
      stepper('Decrement', 'decrement-slot')
      graph.createNode('TEXT', id, {
        name: 'Count',
        text: '9',
        textAutoResize: 'WIDTH_AND_HEIGHT',
        width: 16,
        height: 20,
        componentPropertyReferences: [{ propertyId: 'count', field: 'TEXT' }]
      })
      stepper('Increment', 'increment-slot')
    },
    { width: 100, height: 24 }
  )
  const component = graph.getChildren(graph.getPages()[0].id)[0]
  if (component)
    graph.updateNode(component.id, {
      componentPropertyDefinitions: [
        { id: 'count', name: 'Count', type: 'TEXT', defaultValue: '9' }
      ]
    })
  return graph
}

/** A text field drawn white while empty and grey once filled, its placeholder `Email`. */
function textFieldGraph(): SceneGraph {
  const graph = controlSet(
    'Email',
    { name: 'Filled', values: ['No', 'Yes'] },
    {
      ...emptyBehaviour('textField'),
      texts: { value: { propertyId: 'email' } },
      booleans: { filled: { propertyId: 'value', on: 'Yes', off: 'No' } }
    },
    (graph, variantId, value) => {
      graph.updateNode(variantId, {
        width: 200,
        height: 32,
        fills: value === 'Yes' ? fill(0.95, 0.96, 0.97) : fill(1, 1, 1)
      })
      graph.createNode('TEXT', variantId, {
        name: 'Value',
        text: value === 'Yes' ? 'ada@example.com' : 'Email',
        componentPropertyReferences: [{ propertyId: 'email', field: 'TEXT' }]
      })
    }
  )
  const set = graph.getChildren(graph.getPages()[0].id)[0]
  if (set)
    graph.updateNode(set.id, {
      componentPropertyDefinitions: [
        ...set.componentPropertyDefinitions,
        { id: 'email', name: 'Email', type: 'TEXT', defaultValue: 'Email' }
      ]
    })
  return graph
}

/**
 * Runs the stories' Default story in `#story` the way Storybook does: with its args, then its
 * play function given Storybook's own `within` and `userEvent`. The outcome is recorded on
 * `#story` as `data-played`.
 */
const PLAY_DEFAULT = [
  "import { userEvent, within } from 'storybook/test'",
  'export async function playDefault(story: HTMLElement, play?: (context: object) => Promise<void>) {',
  '  // React renders asynchronously; Storybook runs play only once the story is in the page.',
  '  while (!story.firstElementChild) await new Promise((resolve) => setTimeout(resolve, 10))',
  '  try {',
  '    await play?.({ canvasElement: story, canvas: within(story), userEvent })',
  "    story.dataset.played = 'yes'",
  '  } catch (error) {',
  '    story.dataset.played = String(error)',
  '  }',
  '}'
].join('\n')

/**
 * How each framework's app mounts the generated component with a caller's class, disabled,
 * and as the stories' Default story, whose play function it then runs.
 */
const APPS: Record<
  Framework,
  {
    entry: string
    main: (component: string, stories: string) => string
    plugin: () => PluginOption
  }
> = {
  vue: {
    entry: 'main.ts',
    main: (component, stories) =>
      [
        "import { createApp, h } from 'vue'",
        `import Control from './${component}'`,
        `import * as stories from './${stories}'`,
        "import { playDefault } from './play'",
        "createApp({ render: () => [h('div', { id: 'enabled' }, h(Control, { class: 'custom' })), h('div', { id: 'disabled' }, h(Control, { disabled: true }))] }).mount('#app')",
        "const story = document.getElementById('story')",
        'if (story) {',
        '  createApp({ render: () => h(Control, { ...stories.default.args, ...stories.Default.args }) }).mount(story)',
        '  void playDefault(story, stories.Default.play)',
        '}'
      ].join('\n'),
    plugin: () => vue()
  },
  react: {
    entry: 'main.tsx',
    main: (component, stories) =>
      [
        "import { createRoot } from 'react-dom/client'",
        `import * as Module from './${component.replace(/\.tsx$/, '')}'`,
        `import * as stories from './${stories}'`,
        "import { playDefault } from './play'",
        'const Control = Object.values(Module)[0] as (props: Record<string, unknown>) => JSX.Element',
        "const app = document.getElementById('app')",
        "const story = document.getElementById('story')",
        'if (app && story) {',
        '  createRoot(app).render(<><div id="enabled"><Control className="custom" /></div><div id="disabled"><Control disabled /></div></>)',
        '  createRoot(story).render(<Control {...stories.default.args} {...stories.Default.args} />)',
        '  void playDefault(story, stories.Default.play)',
        '}'
      ].join('\n'),
    plugin: () => react()
  }
}

/**
 * Exports `graph` to stories for `framework`, mounts the generated component in a Vite app
 * under the test's output folder, so it resolves `vue`, `reka-ui`, `react`, and `radix-ui`
 * from the repository as an app would, and serves it.
 */
async function serveComponent(
  graph: SceneGraph,
  framework: Framework,
  folder: string,
  name?: string
): Promise<ViteDevServer> {
  const files = await exportStorybook(graph, { framework })
  const named = (file: { path: string }) => !name || file.path.startsWith(`${name}.`)
  const component = files.find((file) => named(file) && /\.(vue|tsx)$/.test(file.path))
  const stories = files.find((file) => named(file) && file.path.endsWith('.stories.ts'))
  if (!component || !stories) throw new Error('No component was generated')
  await mkdir(folder, { recursive: true })
  for (const file of files) await writeFile(join(folder, file.path), file.content)
  const app = APPS[framework]
  await writeFile(join(folder, 'play.ts'), PLAY_DEFAULT)
  await writeFile(
    join(folder, app.entry),
    app.main(component.path, stories.path.replace(/\.ts$/, ''))
  )
  await writeFile(
    join(folder, 'index.html'),
    `<!doctype html><div id="app"></div><div id="story"></div><script type="module" src="/${app.entry}"></script>`
  )
  const server = await createServer({
    root: folder,
    configFile: false,
    logLevel: 'silent',
    plugins: [app.plugin()],
    server: { port: 0, host: '127.0.0.1' }
  })
  await server.listen()
  return server
}

for (const framework of ['vue', 'react'] as const) {
  test.describe(`generated ${framework} components in a browser`, () => {
    let server: ViteDevServer | undefined
    test.afterEach(async () => {
      await server?.close()
      server = undefined
    })

    test('a switch toggles on click and its state styles move the thumb', async ({
      page
    }, info) => {
      server = await serveComponent(switchGraph(), framework, info.outputPath('switch'))
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      const control = page.locator('#enabled').getByRole('switch')
      const thumb = page.locator('#enabled [class*="switch__thumb"]')
      await expect(control).toHaveAttribute('data-state', 'unchecked')
      await expect(thumb).toHaveCSS('left', '2px')
      // A caller's class joins the generated one, which still styles the root.
      await expect(control).toHaveClass(/custom/)
      await expect(control).toHaveCSS('width', '40px')

      await control.click()
      await expect(control).toHaveAttribute('data-state', 'checked')
      await expect(thumb).toHaveCSS('left', '20px')
      await expect(control).toHaveCSS('background-color', 'rgb(77, 69, 230)')

      const disabled = page.locator('#disabled').getByRole('switch')
      await disabled.click({ force: true })
      await expect(disabled).toHaveAttribute('data-state', 'unchecked')
    })

    test("the default story's play function turns the switch on", async ({ page }, info) => {
      server = await serveComponent(switchGraph(), framework, info.outputPath('story'))
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      await expect(page.locator('#story')).toHaveAttribute('data-played', 'yes')
      await expect(page.locator('#story').getByRole('switch')).toHaveAttribute(
        'data-state',
        'checked'
      )
    })

    test('a switch in the content of a section is the generated switch, operable', async ({
      page
    }, info) => {
      server = await serveComponent(
        sectionGraph(),
        framework,
        info.outputPath('section'),
        'Section'
      )
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      await page.locator('#enabled').getByRole('button').first().click()
      const nested = page.locator('#enabled').getByRole('switch')
      // It starts as the design draws it and keeps working as a switch.
      await expect(nested).toHaveAttribute('data-state', 'checked')
      await nested.click()
      await expect(nested).toHaveAttribute('data-state', 'unchecked')
      await expect(page.locator('#enabled [class*="switch__thumb"]')).toHaveCSS('left', '2px')
      // The section only places the switch; its own state styles still paint it.
      await expect(nested).toHaveCSS('background-color', 'rgb(204, 214, 224)')
    })

    test('a radio group chooses the radio clicked, starting on the one drawn chosen', async ({
      page
    }, info) => {
      server = await serveComponent(radioGroupGraph(), framework, info.outputPath('plan'), 'Plan')
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      const enabled = page.locator('#enabled')
      await expect(enabled.getByRole('radio', { name: 'Basic' })).toBeChecked()
      await enabled.getByRole('radio', { name: 'Pro' }).click()
      await expect(enabled.getByRole('radio', { name: 'Pro' })).toBeChecked()
      await expect(enabled.getByRole('radio', { name: 'Basic' })).not.toBeChecked()
    })

    test('tabs show the panel of the tab clicked', async ({ page }, info) => {
      server = await serveComponent(tabsGraph(), framework, info.outputPath('tabs'), 'Settings')
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      const enabled = page.locator('#enabled')
      await expect(enabled.getByText('Account settings')).toBeVisible()
      await enabled.getByRole('tab', { name: 'Password' }).click()
      await expect(enabled.getByText('Password settings')).toBeVisible()
      await expect(enabled.getByText('Account settings')).toBeHidden()
    })

    test('a slider moves by its step from the keyboard, within its range', async ({
      page
    }, info) => {
      server = await serveComponent(sliderGraph(), framework, info.outputPath('slider'))
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      const thumb = page.locator('#enabled').getByRole('slider')
      await expect(thumb).toHaveAttribute('aria-valuenow', '60')
      // The root lays out at the size the design draws, though Reka and Radix render a span.
      await expect(page.locator('#enabled > *').first()).toHaveCSS('width', '200px')
      await thumb.focus()
      await page.keyboard.press('ArrowRight')
      await expect(thumb).toHaveAttribute('aria-valuenow', '65')
      await page.keyboard.press('End')
      await page.keyboard.press('ArrowRight')
      await expect(thumb).toHaveAttribute('aria-valuenow', '100')
    })

    test('a number field steps with its buttons and settles within its range', async ({
      page
    }, info) => {
      server = await serveComponent(numberFieldGraph(), framework, info.outputPath('quantity'))
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      const enabled = page.locator('#enabled')
      const field = enabled.getByRole('spinbutton')
      await expect(field).toHaveValue('9')
      await enabled.getByRole('button', { name: 'Increase' }).click()
      await expect(field).toHaveValue('10')
      // A value typed past the maximum settles on it once the field is left.
      await field.fill('42')
      await field.blur()
      await expect(field).toHaveValue('10')
    })

    test('a text field takes its filled look while it has words', async ({ page }, info) => {
      server = await serveComponent(textFieldGraph(), framework, info.outputPath('email'))
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      const field = page.locator('#enabled').getByRole('textbox')
      const root = page.locator('#enabled > *').first()
      await expect(field).toHaveAttribute('placeholder', 'Email')
      await expect(root).toHaveCSS('background-color', 'rgb(255, 255, 255)')
      await field.fill('grace@example.com')
      await expect(root).toHaveCSS('background-color', 'rgb(242, 245, 247)')
      await field.fill('')
      await expect(root).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    })

    test('a collapsible shows its content when its trigger opens it', async ({ page }, info) => {
      server = await serveComponent(disclosureGraph(), framework, info.outputPath('disclosure'))
      await page.goto(server.resolvedUrls?.local[0] ?? '')
      const content = page.locator('#enabled [class*="disclosure__content"]')
      await expect(content).toBeHidden()
      await page.locator('#enabled').getByRole('button').click()
      await expect(page.locator('#enabled > [data-state]').first()).toHaveAttribute(
        'data-state',
        'open'
      )
      await expect(content).toBeVisible()
      await expect(content).toHaveCSS('top', '12px')
    })
  })
}
