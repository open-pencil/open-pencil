import { afterAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  accordionComponent,
  buttonSet,
  collapsibleSet,
  labelledButtonSet,
  radioGroupComponent,
  settingsSectionSet,
  switchSet,
  tabsComponent,
  toggleGroupComponent
} from '#dom-css-tests/behaviours/fixtures'
import { exportStorybook } from '#dom-css/index'
import { createSSRApp, h, type Component } from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'

/** The packages generated code imports, linked so it resolves them as an app would. */
const APP_PACKAGES = ['vue', 'reka-ui', '@iconify/vue', 'storybook']

const output = await mkdtemp(join(tmpdir(), 'open-pencil-vue-'))
await mkdir(join(output, 'node_modules'))
await mkdir(join(output, 'node_modules', '@iconify'))
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
  // Bun caches a folder's listing once it imports from it, so each export gets its own.
  const folder = await mkdtemp(join(output, `${name}-`))
  // `./Name.vue` resolves to `Name.vue.ts`, so components and stories import compiled ones.
  for (const file of files.filter((item) => item.path.endsWith('.vue'))) {
    const id = file.path.slice(0, -'.vue'.length)
    const { descriptor, errors } = parse(String(file.content), { filename: file.path })
    expect(errors).toEqual([])
    const script = compileScript(descriptor, { id, inlineTemplate: true })
    await writeFile(join(folder, `${file.path}.ts`), script.content)
  }
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

  test('a text property is a prop the bound layer draws, the design value by default', async () => {
    const { component, stories } = await generate(labelledButtonSet())
    expect(await render(component)).toMatch(/>Save</)
    const sent = await render(component, { label: 'Send <now>' })
    expect(sent).toMatch(/>Send &lt;now&gt;</)
    expect(sent).not.toContain('Save')
    const meta = stories.default as {
      args: Record<string, unknown>
      argTypes: Record<string, unknown>
    }
    expect(meta.args).toMatchObject({ label: 'Save' })
    expect(meta.argTypes).toMatchObject({ label: { control: 'text' } })
  })

  test('an instance of another generated component uses it, even in open-only content, and an icon uses Iconify', async () => {
    const { files, component } = await generate(settingsSectionSet())
    const source = String(files.find((file) => file.path === 'Section.vue')?.content)
    expect(source).toContain(`import Switch from './Switch.vue'`)
    expect(source).toContain('@iconify/vue')
    const html = await render(component, { open: true })
    // The switch is the generated one, drawn on as the design places it, and only once.
    expect(html.match(/role="switch"/g)?.length).toBe(1)
    expect(html).toContain('data-state="checked"')
  })

  test('tabs show the panel of the chosen tab, by the slug of its label', async () => {
    const { component } = await generate(tabsComponent())
    const first = await render(component)
    expect(first).toContain('role="tablist"')
    expect(first).toContain('Account settings')
    expect(first).not.toContain('Password settings')
    const second = await render(component, { value: 'password' })
    expect(second).toContain('Password settings')
    expect(second).not.toContain('Account settings')
  })

  test('a radio group writes an item component and chooses among its labelled items', async () => {
    const { files, component } = await generate(radioGroupComponent())
    expect(files.map((file) => file.path)).toContain('PlanItem.vue')
    const checked = (html: string) =>
      [...html.matchAll(/<button[^>]*role="radio"[^>]*>/g)].map((tag) =>
        tag[0].includes('aria-checked="true"')
      )
    // The design draws the second item chosen.
    const drawn = await render(component)
    expect(checked(drawn)).toEqual([false, true, false])
    expect(drawn).toContain('Team')
    expect(checked(await render(component, { value: 'team' }))).toEqual([false, false, true])
  })

  test('an item edited directly shows its own words and is chosen by them', async () => {
    const fixture = radioGroupComponent()
    const { graph } = fixture
    const [items] = graph.getChildren(fixture.set.id)
    const last = graph.getChildren(items?.id ?? '').at(-1)
    const label = graph.getChildren(last?.id ?? '').find((layer) => layer.type === 'TEXT')
    if (!label) throw new Error('Expected the item to show its label')
    graph.updateNode(label.id, { text: 'Enterprise' })

    const { component } = await generate(fixture)
    const html = await render(component, { value: 'enterprise' })
    expect(html).toContain('Enterprise')
    expect(html).not.toContain('Team')
    expect(html).toMatch(
      /<button[^>]*aria-checked="true"[^>]*value="enterprise"|value="enterprise"[^>]*aria-checked="true"/
    )
  })

  test("a group's item component is named apart from another component's file", async () => {
    const fixture = radioGroupComponent()
    const page = fixture.graph.getPages()[0].id
    fixture.graph.createNode('COMPONENT', page, { name: 'PlanItem' })
    const files = await exportStorybook(fixture.graph, { framework: 'vue' })
    const paths = files.map((file) => file.path)
    expect(paths).toContain('PlanItem.stories.ts')
    expect(paths).toContain('PlanItem2.vue')
    expect(String(files.find((file) => file.path === 'Plan.vue')?.content)).toContain(
      `import PlanItem2 from './PlanItem2.vue'`
    )
  })

  test("a toggle group's items are the group's item, not the standalone toggle", async () => {
    const { files, component } = await generate(toggleGroupComponent())
    const group = String(files.find((file) => file.path === 'Plan.vue')?.content)
    expect(group).toContain('PlanItem')
    expect(group).not.toMatch(/import \{? ?Toggle\b/)
    const html = await render(component)
    expect([...html.matchAll(/data-state="(on|off)"/g)].map((match) => match[1])).toEqual([
      'on',
      'off'
    ])
  })

  test('an accordion opens the item it is given and starts with none', async () => {
    const { component } = await generate(accordionComponent())
    const states = (html: string) =>
      [...html.matchAll(/<button[^>]*aria-expanded="(true|false)"/g)].map((match) => match[1])
    expect(states(await render(component))).toEqual(['false', 'false'])
    expect(states(await render(component, { value: 'usage' }))).toEqual(['false', 'true'])
    // The heading around each trigger keeps its level but not its own margins.
    expect(await render(component)).toMatch(/<h3[^>]*style="margin:0;font:inherit;?"/)
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
