import { afterAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { buttonSet, collapsibleSet, switchSet } from '#dom-css-tests/behaviours/fixtures'
import { exportStorybook } from '#dom-css/index'
import { createSSRApp, h, type Component } from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'

/** The packages generated code imports, linked so it resolves them as an app would. */
const APP_PACKAGES = ['vue', 'reka-ui', 'storybook']

const output = await mkdtemp(join(tmpdir(), 'open-pencil-vue-'))
await mkdir(join(output, 'node_modules'))
for (const name of APP_PACKAGES)
  await symlink(
    dirname(Bun.resolveSync(`${name}/package.json`, import.meta.dir)),
    join(output, 'node_modules', name)
  )
afterAll(() => rm(output, { recursive: true, force: true }))

/** Exports a fixture's set to Vue stories and loads the component and stories it writes. */
async function generate(fixture: ReturnType<typeof switchSet>) {
  const files = await exportStorybook(fixture.graph, { framework: 'vue' })
  const source = (suffix: string) =>
    String(files.find((file) => file.path.endsWith(suffix))?.content)
  const name = fixture.set.name
  const { descriptor, errors } = parse(source('.vue'), { filename: `${name}.vue` })
  expect(errors).toEqual([])
  const script = compileScript(descriptor, { id: name, inlineTemplate: true })
  // Bun caches a folder's listing once it imports from it, so each export gets its own.
  const folder = await mkdtemp(join(output, `${name}-`))
  // `./Name.vue` resolves to `Name.vue.ts`, so the stories import the compiled component.
  await writeFile(join(folder, `${name}.vue.ts`), script.content)
  await writeFile(join(folder, `${name}.stories.ts`), source('.stories.ts'))
  const component: { default: Component } = await import(join(folder, `${name}.vue.ts`))
  const stories: Record<string, { args?: Record<string, unknown>; play?: unknown }> = await import(
    join(folder, `${name}.stories.ts`)
  )
  return { files, component: component.default, stories }
}

function render(component: Component, props: Record<string, unknown> = {}): Promise<string> {
  return renderToString(createSSRApp({ render: () => h(component, props) }))
}

describe('generated Vue components', () => {
  test('a switch is a Reka switch whose state follows its model', async () => {
    const { files, component } = await generate(switchSet())
    expect(files.map((file) => file.path).sort()).toEqual(['Switch.stories.ts', 'Switch.vue'])
    const off = await render(component)
    expect(off).toContain('role="switch"')
    expect(off).toContain('data-state="unchecked"')
    expect(off).toMatch(/class="switch"/)
    const on = await render(component, { checked: true })
    expect(on).toContain('data-state="checked"')
    expect(on).toContain('aria-checked="true"')
    expect(await render(component, { disabled: true })).toContain('data-disabled')
  })

  test('a collapsible shows its content when open', async () => {
    const { component } = await generate(collapsibleSet())
    const content = (html: string) => /<div class="disclosure__content"[^>]*>/.exec(html)?.[0] ?? ''
    // Reka keeps closed content in the document, hidden; the state styles key on the root.
    const closed = await render(component)
    expect(content(closed)).toContain(' hidden ')
    const open = await render(component, { open: true })
    expect(open).toMatch(/^<div data-state="open" class="disclosure"/)
    expect(content(open)).not.toContain(' hidden ')
  })

  test('a button sets its other variant properties as data attributes', async () => {
    const { component } = await generate(buttonSet())
    const large = await render(component, { size: 'Large' })
    expect(large).toMatch(/^<button[^>]*type="button"/)
    expect(large).toContain('data-size="Large"')
  })
})

describe('generated Vue stories', () => {
  test('show each state and operate the control', async () => {
    const { component, stories } = await generate(switchSet())
    const meta = stories.default as { component: Component; args: Record<string, unknown> }
    expect(meta.component).toBe(component)
    expect(meta.args).toEqual({ checked: false, disabled: false })
    // A module lists its exports alphabetically, not in the order they're written.
    expect(Object.keys(stories).filter((key) => key !== 'default')).toEqual([
      'Checked',
      'Default',
      'Disabled'
    ])
    expect(stories.Checked?.args).toEqual({ checked: true })
    expect(typeof stories.Default?.play).toBe('function')
  })
})
