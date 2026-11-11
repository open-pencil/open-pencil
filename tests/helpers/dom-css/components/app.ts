import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import { createServer, type PluginOption, type ViteDevServer } from 'vite'

import { exportStorybook } from '@open-pencil/dom-css'
import type { SceneGraph } from '@open-pencil/scene-graph'

/** A framework the generated components are exported for. */
export type Framework = 'vue' | 'react'

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
export async function serveComponent(
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
