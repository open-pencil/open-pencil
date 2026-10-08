import { afterAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { buttonSet, collapsibleSet, switchSet } from '#dom-css-tests/behaviours/fixtures'
import { exportStorybook } from '#dom-css/index'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

/** The packages generated code imports, linked so it resolves them as an app would. */
const APP_PACKAGES = ['react', 'react-dom', 'radix-ui', 'storybook']

const output = await mkdtemp(join(tmpdir(), 'open-pencil-react-'))
await mkdir(join(output, 'node_modules'))
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
  return { files, component, stories }
}

const render = (component: ComponentType<Props>, props: Props = {}) =>
  renderToStaticMarkup(createElement(component, props))

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
