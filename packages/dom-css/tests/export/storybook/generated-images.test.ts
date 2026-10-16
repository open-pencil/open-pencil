import { afterAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { switchSet } from '#dom-css-tests/behaviours/fixtures'
import { exportStorybook, type StorybookFile } from '#dom-css/export/storybook/export'

import { es } from '@open-pencil/emit'

const folders: string[] = []
afterAll(() => Promise.all(folders.map((folder) => rm(folder, { recursive: true, force: true }))))

interface Stories {
  default: {
    args: Record<string, string | boolean>
    parameters?: { design: { name: string; type: string; url: string }[] }
  }
  Default: { play?: object }
  Checked?: { args: Record<string, boolean> }
}

/** Load the actual emitted metadata and stories, substituting only the component dependency. */
async function loadStories(files: StorybookFile[]): Promise<Stories> {
  const story = files.find((file) => file.path.endsWith('.stories.ts'))
  if (!story) throw new Error('Expected generated stories')
  const folder = await mkdtemp(join(tmpdir(), 'open-pencil-storybook-images-'))
  folders.push(folder)
  await mkdir(join(folder, 'node_modules'))
  await symlink(
    dirname(Bun.resolveSync('storybook/package.json', import.meta.dir)),
    join(folder, 'node_modules', 'storybook')
  )
  await writeFile(join(folder, 'component.ts'), 'export const Switch = {}; export default Switch')
  const module = es.parseModule(String(story.content))
  for (const node of module.body) {
    if (node.type !== 'ImportDeclaration') continue
    const source = es.child(node, 'source')
    if (typeof source?.value === 'string' && source.value.startsWith('./Switch'))
      node.source = es.string('./component.ts')
  }
  const path = join(folder, story.path)
  await writeFile(path, es.printModule(module))
  return import(path)
}

describe.each(['vue', 'react'] as const)('generated %s story design images', (framework) => {
  test('renders every variant and labels each image without changing args or play', async () => {
    const { graph, set } = switchSet()
    const variants = graph.getChildren(set.id)
    const rendered: string[] = []
    const files = await exportStorybook(graph, {
      framework,
      linkPath: 'design/switch.fig',
      renderDesignImage: async (id) => {
        rendered.push(id)
        return new TextEncoder().encode(id)
      }
    })
    const images = files.filter((file) => file.path.endsWith('.png'))
    expect(rendered).toEqual(variants.map((variant) => variant.id))
    expect(images).toHaveLength(variants.length)
    expect(images.map((image) => image.content)).toEqual(
      rendered.map((id) => new TextEncoder().encode(id))
    )

    const stories = await loadStories(files)
    const designs = stories.default.parameters?.design ?? []
    expect(designs[0]).toMatchObject({ name: 'OpenPencil', type: 'link' })
    expect(designs.slice(1).map((design) => design.name)).toEqual(
      variants.map((variant) => `Design: ${variant.name}`)
    )
    for (const [index, image] of images.entries()) {
      expect(designs[index + 1]?.type).toBe('image')
      expect(designs[index + 1]?.url).toEndWith(`/${image.path}`)
    }
    const value = framework === 'vue' ? 'checked' : 'defaultChecked'
    expect(stories.default.args).toEqual({ [value]: false, disabled: false })
    expect(stories.Checked?.args).toEqual({ [value]: true })
    expect(typeof stories.Default.play).toBe('function')
  })

  test('keeps all labelled references in single mode, whose controls still vary', async () => {
    const { graph, set } = switchSet()
    const rendered: string[] = []
    const files = await exportStorybook(graph, {
      framework,
      plan: () => ({ stories: 'single' }),
      renderDesignImage: async (id) => {
        rendered.push(id)
        return new Uint8Array([1])
      }
    })
    const stories = await loadStories(files)
    expect(rendered).toEqual(graph.getChildren(set.id).map((variant) => variant.id))
    expect(stories.default.parameters?.design).toHaveLength(rendered.length)
    expect(stories.Checked).toBeUndefined()
    expect(typeof stories.Default.play).toBe('function')
  })

  test('keeps repeated variant names distinguishable in the design panel', async () => {
    const { graph, set } = switchSet()
    for (const variant of graph.getChildren(set.id))
      graph.updateNode(variant.id, { name: 'Repeated variant' })
    const files = await exportStorybook(graph, {
      framework,
      renderDesignImage: async () => new Uint8Array([1])
    })
    const stories = await loadStories(files)
    expect(stories.default.parameters?.design.map((design) => design.name)).toEqual([
      'Design: Repeated variant',
      'Design: Repeated variant 2',
      'Design: Repeated variant 3',
      'Design: Repeated variant 4',
      'Design: Repeated variant 5',
      'Design: Repeated variant 6'
    ])
  })

  test('keeps links and interactions without images when no renderer is supplied', async () => {
    const { graph } = switchSet()
    const files = await exportStorybook(graph, { framework, linkPath: 'design/switch.fig' })
    expect(files.filter((file) => file.path.endsWith('.png'))).toEqual([])
    const stories = await loadStories(files)
    expect(stories.default.parameters?.design).toEqual([
      {
        name: 'OpenPencil',
        type: 'link',
        url: 'openpencil://open?file=design%2Fswitch.fig&node=Switch'
      }
    ])
    expect(typeof stories.Default.play).toBe('function')
  })
})
