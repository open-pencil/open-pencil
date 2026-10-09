import { afterAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  accordionComponent,
  badgeToggleSet,
  numberFieldComponent,
  progressComponent,
  sliderComponent,
  textareaComponent,
  textFieldSet,
  buttonSet,
  collapsibleSet,
  labelledButtonSet,
  radioGroupComponent,
  settingsSectionSet,
  switchSet,
  tabsComponent,
  toggleGroupComponent
} from '#dom-css-tests/behaviours/fixtures'
import { cssRules } from '#dom-css-tests/helpers'
import { exportStorybook } from '#dom-css/index'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

/** The packages generated code imports, linked so it resolves them as an app would. */
const APP_PACKAGES = [
  'react',
  'react-dom',
  'radix-ui',
  '@iconify/react',
  'storybook',
  '@types/react'
]

const output = await mkdtemp(join(tmpdir(), 'open-pencil-react-'))
await mkdir(join(output, 'node_modules'))
await mkdir(join(output, 'node_modules', '@iconify'))
await mkdir(join(output, 'node_modules', '@types'))
for (const name of APP_PACKAGES)
  await symlink(
    dirname(Bun.resolveSync(`${name}/package.json`, import.meta.dir)),
    join(output, 'node_modules', name)
  )
afterAll(() => rm(output, { recursive: true, force: true }))

type Props = Record<string, unknown>

/** Exports a fixture's set to React stories and loads the component and stories it writes. */
async function generate(fixture: ReturnType<typeof switchSet>) {
  const files = await exportStorybook(fixture.graph, { framework: 'react' })
  const name = fixture.set.name
  // Bun caches a folder's listing once it imports from it, so each export gets its own.
  const folder = await mkdtemp(join(output, `${name}-`))
  for (const file of files) await writeFile(join(folder, file.path), file.content)
  const module: Record<string, ComponentType<Props>> = await import(join(folder, `${name}.tsx`))
  const stories: Record<string, { args?: Props; play?: unknown }> = await import(
    join(folder, `${name}.stories.ts`)
  )
  const component = module[name]
  if (!component) throw new Error(`${name}.tsx exports no ${name}`)
  return { files, component, stories, folder }
}

const CSS_MODULES =
  "declare module '*.module.css' { const styles: Record<string, string>; export default styles }"

/** A generated component's type errors, checked as an app's strict TypeScript would. */
async function typeErrors(folder: string, name: string): Promise<string[]> {
  await writeFile(join(folder, 'css-modules.d.ts'), CSS_MODULES)
  const program = ts.createProgram(
    [join(folder, `${name}.tsx`), join(folder, 'css-modules.d.ts')],
    {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      types: []
    }
  )
  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
}

const render = (component: ComponentType<Props>, props: Props = {}) =>
  renderToStaticMarkup(createElement(component, props))

describe('generated React form controls', () => {
  test('type-check against Radix and React', async () => {
    for (const fixture of [
      sliderComponent(),
      progressComponent(),
      numberFieldComponent(),
      textFieldSet(),
      textareaComponent()
    ]) {
      const { folder } = await generate(fixture)
      expect(await typeErrors(folder, fixture.set.name)).toEqual([])
    }
  })

  test("a slider starts at the design's value as Radix's list, within its range", async () => {
    const { component } = await generate(sliderComponent())
    // Radix places its range from the value, already on the server.
    expect(render(component)).toContain('right:40%')
    expect(render(component, { defaultValue: [25] })).toContain('right:75%')
  })

  test("a progress bar's indicator reaches the value's share of its range", async () => {
    const { component } = await generate(progressComponent())
    expect(render(component)).toContain('width:25%')
    expect(render(component, { value: 150 })).toContain('width:75%')
    // A value past the end fills the indicator, and no further.
    expect(render(component, { value: 500 })).toContain('width:100%')
  })

  test('a number field is a native number input between steppers named for what they do', async () => {
    const { component } = await generate(numberFieldComponent())
    const html = render(component)
    expect(html).toMatch(/<input[^>]*type="number"[^>]*value="2"/)
    expect(html).toMatch(/<input[^>]*min="1"[^>]*max="10"/)
    expect(html).toContain('aria-label="Decrease"')
    expect(html).toContain('aria-label="Increase"')
    expect(render(component, { defaultValue: 7 })).toMatch(/<input[^>]*value="7"/)
  })

  test('a text field takes its props on its input, starting empty with its placeholder', async () => {
    const { component } = await generate(textFieldSet())
    const html = render(component, { name: 'email', className: 'custom' })
    expect(html).toMatch(/<input[^>]*placeholder="Email"[^>]*name="email"/)
    // The caller's class goes on the root, as on every generated component.
    expect(html).toMatch(/^<div class="[^"]*custom/)
  })

  test('a textarea starts with its words', async () => {
    const { component } = await generate(textareaComponent())
    expect(render(component)).toMatch(/<textarea[^>]*>Tell us more<\/textarea>/)
  })
})

describe('generated React components', () => {
  test('a switch is a Radix switch whose state follows its props', async () => {
    const { files, component } = await generate(switchSet())
    expect(files.map((file) => file.path).sort()).toEqual([
      'Switch.module.css',
      'Switch.stories.ts',
      'Switch.tsx'
    ])
    const off = render(component)
    expect(off).toContain('role="switch"')
    expect(off).toContain('data-state="unchecked"')
    expect(render(component, { defaultChecked: true })).toContain('data-state="checked"')
    expect(render(component, { checked: true })).toContain('aria-checked="true"')
    expect(render(component, { disabled: true })).toContain('data-disabled=""')
    // Bun loads CSS modules as empty objects, so the generated classes are checked in the browser.
    expect(render(component, { className: 'custom' })).toContain('class="custom"')
  })

  test('a collapsible opens its content', async () => {
    const { component } = await generate(collapsibleSet())
    expect(render(component)).toContain('data-state="closed"')
    expect(render(component, { defaultOpen: true })).toMatch(/^<div data-state="open"/)
  })

  test('a text property is a prop the bound layer draws, kept off the root element', async () => {
    const { component, stories } = await generate(labelledButtonSet())
    expect(render(component)).toMatch(/>Save</)
    const sent = render(component, { label: 'Send <now>' })
    expect(sent).toMatch(/>Send &lt;now&gt;</)
    expect(sent).not.toContain('label=')
    const meta = stories.default as { args?: Record<string, unknown> }
    expect(meta.args).toMatchObject({ label: 'Save' })
  })

  test('an instance of another generated component uses it, even in open-only content, and an icon uses Iconify', async () => {
    const { files, component } = await generate(settingsSectionSet())
    const source = String(files.find((file) => file.path === 'Section.tsx')?.content)
    expect(source).toContain(`import { Switch } from "./Switch"`)
    expect(source).toContain('@iconify/react')
    const html = render(component, { defaultOpen: true })
    // The switch is the generated one, drawn on as the design places it, and only once.
    expect(html.match(/role="switch"/g)?.length).toBe(1)
    expect(html).toContain('data-state="checked"')
  })

  test('tabs show the panel of the chosen tab, by the slug of its label', async () => {
    const { component } = await generate(tabsComponent())
    const first = render(component)
    expect(first).toContain('role="tablist"')
    expect(first).toContain('Account settings')
    expect(first).not.toContain('Password settings')
    const second = render(component, { defaultValue: 'password' })
    expect(second).toContain('Password settings')
    expect(second).not.toContain('Account settings')
  })

  test('every tab trigger rests unchosen and takes the chosen look while active, in its place', async () => {
    const { files } = await generate(tabsComponent())
    const rules = cssRules(
      String(files.find((file) => file.path === 'Settings.module.css')?.content)
    )
    const [first, second] = ['.settings .settings__trigger', '.settings .settings__trigger-2'].map(
      (selector) => ({
        rest: rules.get(selector),
        active: rules.get(`${selector}[data-state="active"]`)
      })
    )
    // The design draws the first tab chosen; at rest it looks like the others, where it is drawn.
    expect(first?.rest?.['background-color']).toBe(second?.rest?.['background-color'])
    expect([first?.rest?.left, second?.rest?.left]).toEqual(['0px', '90px'])
    expect(first?.active).toEqual({ 'background-color': '#4F45E6' })
    expect(second?.active).toEqual(first?.active)
  })

  test('a layer drawn as a frame in one state and an instance in another is both', async () => {
    const { files, component } = await generate(badgeToggleSet())
    const css = cssRules(String(files.find((file) => file.path === 'Alert.module.css')?.content))
    // The pressed state uses the generated switch where the resting one draws its own badge.
    expect(render(component)).toContain('role="switch"')
    expect(css.get('.alert .alert__badge')?.display).toBe('none')
    expect(css.get('.alert[data-state="on"] .alert__badge')).toEqual({ display: 'revert' })
    expect(css.get('.alert[data-state="on"] .alert__badge-2')).toEqual({ display: 'none' })
  })

  test('a radio group writes an item component and chooses among its labelled items', async () => {
    const { files, component } = await generate(radioGroupComponent())
    expect(files.map((file) => file.path)).toContain('PlanItem.tsx')
    const checked = (html: string) =>
      [...html.matchAll(/<button[^>]*role="radio"[^>]*>/g)].map((tag) =>
        tag[0].includes('aria-checked="true"')
      )
    // The design draws the second item chosen.
    const drawn = render(component)
    expect(checked(drawn)).toEqual([false, true, false])
    expect(drawn).toContain('Team')
    expect(checked(render(component, { defaultValue: 'team' }))).toEqual([false, false, true])
  })

  test("a toggle group's items are the group's item, not the standalone toggle", async () => {
    const { files, component } = await generate(toggleGroupComponent())
    const group = String(files.find((file) => file.path === 'Plan.tsx')?.content)
    expect(group).toContain('PlanItem')
    expect(group).not.toMatch(/import \{? ?Toggle\b/)
    const html = render(component)
    expect([...html.matchAll(/data-state="(on|off)"/g)].map((match) => match[1])).toEqual([
      'on',
      'off'
    ])
  })

  test('an accordion opens the item it is given and starts with none', async () => {
    const { component } = await generate(accordionComponent())
    const states = (html: string) =>
      [...html.matchAll(/<button[^>]*aria-expanded="(true|false)"/g)].map((match) => match[1])
    expect(states(render(component))).toEqual(['false', 'false'])
    expect(states(render(component, { defaultValue: 'usage' }))).toEqual(['false', 'true'])
    // The heading around each trigger keeps its level but not its own margins.
    expect(render(component)).toMatch(/<h3[^>]*style="margin:0;font:inherit"/)
  })

  test('a single choice group takes the single choice props Radix types', async () => {
    for (const fixture of [accordionComponent(), toggleGroupComponent()]) {
      const { folder } = await generate(fixture)
      expect(await typeErrors(folder, fixture.set.name)).toEqual([])
    }
  })

  test('a button sets its other variant properties as data attributes', async () => {
    const { component } = await generate(buttonSet())
    const large = render(component, { size: 'Large' })
    expect(large).toMatch(/^<button[^>]*type="button"/)
    expect(large).toContain('data-size="Large"')
  })
})

describe('generated React stories', () => {
  test('set the uncontrolled value so the play function can change it', async () => {
    const { component, stories } = await generate(switchSet())
    const meta = stories.default as { component: unknown; args: Props }
    expect(meta.component).toBe(component)
    expect(meta.args).toEqual({ defaultChecked: false, disabled: false })
    expect(stories.Checked?.args).toEqual({ defaultChecked: true })
    expect(typeof stories.Default?.play).toBe('function')
  })
})
