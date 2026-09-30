import { describe, expect, it } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { exportStorybook } from '#dom-css/index'

import { SceneGraph } from '@open-pencil/scene-graph'

function buttonGraph() {
  const graph = new SceneGraph()
  const page = graph.addPage('Library')
  const set = graph.createNode('COMPONENT_SET', page.id, {
    name: 'Button',
    componentPropertyDefinitions: [
      {
        id: 'size',
        name: 'Size',
        type: 'VARIANT',
        defaultValue: 'Small',
        variantOptions: ['Small', 'Large']
      }
    ]
  })
  for (const [size, width] of [
    ['Small', 80],
    ['Large', 160]
  ] as const) {
    const variant = graph.createNode('COMPONENT', set.id, {
      name: `Size=${size}`,
      width,
      height: 40,
      componentPropertyValues: { Size: size }
    })
    graph.createNode('TEXT', variant.id, { name: 'Label', text: `<b>${size}</b>` })
  }
  return { graph, page }
}

interface Story {
  name: string
  args: Record<string, string>
  parameters?: { design: { name: string; type: string; url: string }[] }
}

interface StoryModule {
  default: {
    title: string
    args: Record<string, string>
    argTypes: Record<string, unknown>
    render: (args: object) => string
  }
  [story: string]: unknown
}

function storyExport(module: StoryModule, name: string): Story {
  return module[name] as Story
}

async function importStory(content: string): Promise<StoryModule> {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-storybook-'))
  const path = join(dir, 'story.ts')
  await writeFile(path, content)
  return import(path)
}

describe('exportStorybook', () => {
  it('turns a component set into a story per variant with select controls', async () => {
    const { graph } = buttonGraph()
    const files = await exportStorybook(graph, { framework: 'html', linkPath: 'design/ui kit.fig' })

    expect(files.map((file) => file.path)).toEqual(['Button.stories.ts'])
    const content = String(files[0]?.content)
    expect(content).toContain('openpencil://open?file=design%2Fui%20kit.fig&node=Button')
    // Variant layers named `Size=Small` are unique here, so each story links to its own.
    expect(content).toContain('openpencil://open?file=design%2Fui%20kit.fig&node=Size%3DLarge')

    const story = await importStory(content)
    expect(story.default.title).toBe('Library/Button')
    expect(story.default.argTypes).toEqual({
      Size: { control: 'select', options: ['Small', 'Large'] }
    })
    expect(story.default.args).toEqual({ Size: 'Small' })
    expect(content.indexOf('export const Small')).toBeLessThan(
      content.indexOf('export const Large')
    )
    expect(story.Large).toMatchObject({ name: 'Size=Large', args: { Size: 'Large' } })

    const large = story.default.render({ Size: 'Large' })
    expect(large).toContain('width: 160px')
    expect(large).toContain('&lt;b&gt;Large&lt;/b&gt;')
    expect(() => story.default.render({ Size: 'Huge' })).toThrow('Button has no variant ["Huge"]')
  })

  it('groups slash-named components and keeps standalone ones apart', async () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Icons')
    graph.createNode('COMPONENT', page.id, { name: 'Icon/Arrow', width: 16, height: 16 })
    graph.createNode('COMPONENT', page.id, { name: 'Icon/Check', width: 24, height: 24 })
    graph.createNode('COMPONENT', page.id, { name: 'Badge', width: 32, height: 16 })

    const files = await exportStorybook(graph, { framework: 'html', pageId: page.id })
    expect(files.map((file) => file.path)).toEqual(['Badge.stories.ts', 'Icon.stories.ts'])

    const icon = await importStory(String(files[1]?.content))
    expect(icon.default.title).toBe('Icons/Icon')
    expect(icon.default.render({ Variant: 'Check' })).toContain('width: 24px')
    const badge = await importStory(String(files[0]?.content))
    expect(badge.default.render({})).toContain('width: 32px')
  })

  it('keys variants by layer name when their property values collide', async () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Library')
    const set = graph.createNode('COMPONENT_SET', page.id, { name: 'Chip' })
    graph.createNode('COMPONENT', set.id, { name: 'Chip', width: 40, height: 20 })
    graph.createNode('COMPONENT', set.id, { name: 'Chip', width: 60, height: 20 })

    const story = await importStory(
      String((await exportStorybook(graph, { framework: 'html' }))[0]?.content)
    )
    expect(story.default.args).toEqual({ Variant: 'Chip' })
    expect(story.default.render({ Variant: 'Chip 2' })).toContain('width: 60px')
  })

  it('emits framework-specific render wrappers', async () => {
    const { graph } = buttonGraph()
    const react = String((await exportStorybook(graph, { framework: 'react' }))[0]?.content)
    const vue = String((await exportStorybook(graph, { framework: 'vue' }))[0]?.content)

    expect(react).toContain("from '@storybook/react-vite'")
    expect(react).toContain('dangerouslySetInnerHTML')
    expect(react).not.toContain('openpencil://')
    expect(vue).toContain("from '@storybook/vue3-vite'")
    expect(vue).toContain("h('div', { innerHTML: variantHTML(args) })")
  })

  it('writes a design image per variant and links stories to it', async () => {
    const { graph } = buttonGraph()
    graph.createNode('FRAME', graph.getPages()[0]?.id ?? '', { name: 'Size=Large' })
    const rendered: string[] = []
    const files = await exportStorybook(graph, {
      framework: 'html',
      linkPath: 'ui.pen',
      renderDesignImage: async (nodeId) => {
        rendered.push(nodeId)
        return new Uint8Array([nodeId.length])
      }
    })

    expect(files.map((file) => file.path)).toEqual([
      'Button.design/Small.png',
      'Button.design/Large.png',
      'Button.stories.ts'
    ])
    expect(rendered).toHaveLength(2)
    const story = await importStory(String(files[2]?.content))
    const [link, image] = storyExport(story, 'Large').parameters?.design ?? []
    expect(image).toMatchObject({ name: 'Design', type: 'image' })
    expect(image?.url).toEndWith('/Button.design/Large.png')
    // A second `Size=Large` layer makes that name ambiguous, so the story links to the set.
    expect(link?.url).toEndWith('node=Button')
  })

  it('gives same-named components on a page distinct titles', async () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Library')
    graph.createNode('COMPONENT', page.id, { name: 'Card', width: 10, height: 10 })
    graph.createNode('COMPONENT', page.id, { name: 'Card', width: 20, height: 10 })

    const files = await exportStorybook(graph, { framework: 'html' })
    expect(files.map((file) => file.path)).toEqual(['Card.stories.ts', 'Card2.stories.ts'])
    expect((await importStory(String(files[1]?.content))).default.title).toBe('Library/Card 2')

    // Storybook ids ignore case, so `library/Card` would collide with `Library/Card`.
    const lower = graph.addPage('library')
    graph.createNode('COMPONENT', lower.id, { name: 'Card', width: 5, height: 5 })
    const withLower = await exportStorybook(graph, { framework: 'html' })
    expect((await importStory(String(withLower[2]?.content))).default.title).toBe('library/Card 3')

    // A one-page export names its files as the full export does.
    const other = graph.addPage('Other')
    graph.createNode('COMPONENT', other.id, { name: 'Card', width: 30, height: 10 })
    const pageFiles = await exportStorybook(graph, { framework: 'html', pageId: other.id })
    expect(pageFiles.map((file) => file.path)).toEqual(['Card4.stories.ts'])
  })

  it('tags every file with the page it was generated from', async () => {
    const { graph } = buttonGraph()
    graph.createNode('COMPONENT', graph.addPage('Icons').id, { name: 'Star', width: 8, height: 8 })

    const files = await exportStorybook(graph, { framework: 'html' })
    expect(files.map(({ path, page }) => [path, page])).toEqual([
      ['Button.stories.ts', 'Library'],
      ['Star.stories.ts', 'Icons']
    ])
    expect(String(files[0]?.content).split('\n', 1)).toEqual([
      '// Generated by OpenPencil. Re-export to update; edits are overwritten.'
    ])
  })

  it('omits the link when neither the variant nor its set has a unique name', async () => {
    const { graph } = buttonGraph()
    const other = graph.addPage('Other')
    graph.createNode('FRAME', other.id, { name: 'Button' })
    graph.createNode('FRAME', other.id, { name: 'Size=Small' })

    const [story] = await exportStorybook(graph, { framework: 'html', linkPath: 'ui.fig' })
    const content = String(story?.content)
    expect(content).toContain('node=Size%3DLarge')
    expect(content).not.toContain('node=Button')
    expect(content).not.toContain('node=Size%3DSmall')
  })
})
