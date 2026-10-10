import { afterAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  accordionComponent,
  buttonSet,
  collapsibleSet,
  labelledButtonSet,
  numberFieldComponent,
  plainBadgeSet,
  progressComponent,
  sliderComponent,
  textareaComponent,
  textFieldSet,
  radioGroupComponent,
  settingsSectionSet,
  switchSet,
  tabsComponent,
  toggleGroupComponent
} from '#dom-css-tests/behaviours/fixtures'
import { cssRules } from '#dom-css-tests/helpers'
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

  test('an item takes the words its label property assigns, before its layer is synced', async () => {
    const fixture = radioGroupComponent()
    const { graph } = fixture
    const [items] = graph.getChildren(fixture.set.id)
    const last = graph.getChildren(items?.id ?? '').at(-1)
    if (!last) throw new Error('Expected the last item')
    graph.updateNode(last.id, {
      componentPropertyAssignments: { ...last.componentPropertyAssignments, label: 'Scale' }
    })
    const { component } = await generate(fixture)
    expect(await render(component, { value: 'scale' })).toContain('Scale')
  })

  test('an item without its label assigned shows the words its layer reads', async () => {
    const fixture = radioGroupComponent()
    const { graph } = fixture
    const [items] = graph.getChildren(fixture.set.id)
    const last = graph.getChildren(items?.id ?? '').at(-1)
    const label = graph.getChildren(last?.id ?? '').find((layer) => layer.type === 'TEXT')
    if (!last || !label) throw new Error('Expected the item to show its label')
    graph.updateNode(last.id, { componentPropertyAssignments: {} })
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

/** The rules of a single-file component's scoped stylesheet, by selector. */
const styleOf = (files: { path: string; content: string | Uint8Array }[], path: string) =>
  cssRules(
    /<style scoped>([\s\S]*)<\/style>/.exec(
      String(files.find((file) => file.path === path)?.content)
    )?.[1] ?? ''
  )

describe('generated Vue plain components', () => {
  test('take variant, text, and boolean properties as props, and slots as slots', async () => {
    const { component } = await generate(plainBadgeSet())
    const rest = await render(component)
    expect(rest).toContain('data-tone="Neutral"')
    expect(rest).toContain('New')
    // The icon the design hides at rest shows only while its boolean is on.
    expect(rest).not.toContain('badge__dot')
    expect(await render(component, { icon: true })).toContain('badge__dot')
    expect(await render(component, { tone: 'Danger', label: 'Hot' })).toMatch(
      /data-tone="Danger"[\s\S]*Hot/
    )
    // A slot shows the design's content unless the caller passes its own.
    expect(rest).toContain('Note')
    const filled = await renderToString(
      createSSRApp({ render: () => h(component, {}, { extra: () => h('b', 'Custom') }) })
    )
    expect(filled).toContain('<b>Custom</b>')
    expect(filled).not.toContain('Note')
  })
})

describe('generated Vue form controls', () => {
  test('a slider binds one number within its range, the thumb and range placed by Reka', async () => {
    const { files, component } = await generate(sliderComponent())
    // Reka shows its thumb once mounted; its range already reaches the value on the server.
    const range = (html: string) => /style="([^"]*)" class="volume__range"/.exec(html)?.[1]
    expect(range(await render(component))).toBe('left:0%;right:40%;')
    expect(range(await render(component, { value: 25 }))).toBe('left:0%;right:75%;')
    expect(await render(component)).toContain('aria-valuemax="100"')
    const css = styleOf(files, 'Volume.vue')
    // Reka sets where they are from the value, so the place the design draws them at goes.
    expect(css.get('.volume .volume__thumb')?.left).toBeUndefined()
    expect(css.get('.volume .volume__range')?.width).toBeUndefined()
    // Its root is a span, which lays out as the block the design draws.
    expect(css.get('.volume')?.display).toBe('block')
    expect(css.get('.volume .volume__thumb')?.['box-sizing']).toBe('border-box')
  })

  test("a progress bar's indicator reaches the value's share of its range", async () => {
    const { component } = await generate(progressComponent())
    expect(await render(component)).toMatch(
      /class="upload__indicator"[^>]*style="width:25%;"|style="width:25%;"[^>]*class="upload__indicator"/
    )
    expect(await render(component, { value: 150 })).toContain('width:75%;')
    // A value past the end fills the indicator, and no further.
    expect(await render(component, { value: 500 })).toContain('width:100%')
  })

  test('a number field shows its value in its input, and its root hugs it', async () => {
    const { files, component } = await generate(numberFieldComponent())
    expect(await render(component)).toMatch(/<input[^>]*value="2"/)
    expect(await render(component, { value: 7 })).toMatch(/<input[^>]*value="7"/)
    expect(styleOf(files, 'Quantity.vue').get('.quantity')?.width).toBe('fit-content')
  })

  test('a text field starts empty with its placeholder, and looks filled while it has words', async () => {
    const { files, component } = await generate(textFieldSet())
    const html = await render(component)
    expect(html).toMatch(/<input[^>]*placeholder="Email"/)
    expect(html).not.toContain('ada@example.com')
    expect(await render(component, { value: 'grace@example.com' })).toContain(
      'value="grace@example.com"'
    )
    const css = styleOf(files, 'Email.vue')
    const input = [...css].find(([selector]) => /^\.email \.email__value[^:]*$/.test(selector))?.[1]
    const placeholder = [...css].find(([selector]) => selector.endsWith('::placeholder'))?.[1]
    // Typed words take the filled look; the empty look is the placeholder's.
    expect(input?.color).toBe('#121726')
    expect(placeholder?.color).toBe('#9CA3B0')
  })

  test('a textarea starts with its words', async () => {
    const { component } = await generate(textareaComponent())
    expect(await render(component)).toMatch(/<textarea[^>]*>Tell us more<\/textarea>/)
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

  test('tag every state after Default, so Storybook can show one story per component', async () => {
    const { stories } = await generate(switchSet())
    const tags = (name: string) => (stories[name] as { tags?: string[] } | undefined)?.tags
    expect((stories.default as { tags: string[] }).tags).toContain('openpencil')
    expect(tags('Default')).toBeUndefined()
    expect(tags('Checked')).toEqual(['variant'])
    expect(tags('Disabled')).toEqual(['variant'])
  })
})
