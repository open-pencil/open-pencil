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

type Framework = 'vue' | 'react'

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
  folder: string
): Promise<ViteDevServer> {
  const files = await exportStorybook(graph, { framework })
  const component = files.find((file) => /\.(vue|tsx)$/.test(file.path))
  const stories = files.find((file) => file.path.endsWith('.stories.ts'))
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
