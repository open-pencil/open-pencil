import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { sceneNodeToDesignDocument } from '../from-scene-graph'
import type { ExportHTMLFile } from '../html-export'
import { serializeHTML } from '../serialize'
import { collectGroups, type StoryGroup } from './groups'
import { printStoryModule, type StoryDesign, type StorybookFramework } from './module'
import { claimName, identifierName, storyId } from './names'

export { STORYBOOK_FRAMEWORKS, type StorybookFramework } from './module'

export interface ExportStorybookOptions {
  framework?: StorybookFramework
  /** Limit the export to one page. Defaults to every page. */
  pageId?: string
  /** Repository-relative `.fig`/`.pen` path; adds an `openpencil://` design link to stories. */
  linkPath?: string
  /** Renders a variant to PNG; each story then shows it next to the link as its design. */
  renderDesignImage?: (nodeId: string) => Promise<Uint8Array>
}

export interface StorybookFile extends ExportHTMLFile {
  /** Name of the page the file was generated from. */
  page: string
}

/** Layers whose name no other layer carries; the link scheme can only address those. */
function uniqueLayerNames(graph: SceneGraph): Set<string> {
  const counts = new Map<string, number>()
  for (const node of graph.getAllNodes()) counts.set(node.name, (counts.get(node.name) ?? 0) + 1)
  return new Set([...counts].filter(([, count]) => count === 1).map(([name]) => name))
}

interface ModuleContext {
  graph: SceneGraph
  framework: StorybookFramework
  linkPath?: string
  uniqueNames: Set<string>
  /** Export name of each story, by variant index. */
  storyNames: string[]
  /** Import path of each variant's design image, by variant index. */
  images: string[]
}

function designLink(context: ModuleContext, ...candidates: (string | undefined)[]): StoryDesign[] {
  const node = candidates.find((name) => name !== undefined && context.uniqueNames.has(name))
  if (!context.linkPath || !node) return []
  const url = `openpencil://open?file=${encodeURIComponent(context.linkPath)}&node=${encodeURIComponent(node)}`
  return [{ type: 'link', url }]
}

/** Story export names, which also name the design images. */
function storyNames(group: StoryGroup): string[] {
  const taken = new Set<string>()
  const key = (name: string) => name.toLowerCase()
  return group.variants.map((variant) => {
    const text = group.props.length === 0 ? 'Default' : variant.values.join(' ')
    return claimName(identifierName(text, 'Variant'), taken, { key })
  })
}

function storyLabel(group: StoryGroup, values: string[]): string {
  if (group.props.length === 0) return 'Default'
  return group.props.map((prop, i) => `${prop.name}=${values[i] ?? ''}`).join(', ')
}

function storyModule(group: StoryGroup, context: ModuleContext): string {
  return printStoryModule({
    framework: context.framework,
    title: group.title,
    name: group.name,
    props: group.props,
    variants: group.variants.map((variant) => ({
      values: variant.values,
      html: serializeHTML(sceneNodeToDesignDocument(context.graph, variant.node.id, false))
    })),
    metaDesign: designLink(context, group.linkNode),
    images: context.images,
    stories: group.variants.map((variant, i) => ({
      exportName: context.storyNames[i] ?? '',
      label: storyLabel(group, variant.values),
      values: variant.values,
      design: [
        ...designLink(context, variant.node.name, group.linkNode),
        ...(context.images[i] ? [{ type: 'image' as const, variant: i }] : [])
      ]
    }))
  })
}

/**
 * Generate one CSF3 `.stories.ts` file per component or component set, plus a
 * `<Name>.design/` folder of variant images when `renderDesignImage` is given.
 */
export async function exportStorybook(
  graph: SceneGraph,
  options: ExportStorybookOptions = {}
): Promise<StorybookFile[]> {
  const framework = options.framework ?? 'react'
  const uniqueNames = uniqueLayerNames(graph)
  const takenFiles = new Set<string>()
  const takenIds = new Set<string>()
  const files: StorybookFile[] = []
  const add = (page: SceneNode, path: string, content: string | Uint8Array) =>
    files.push({ path, content, page: page.name })

  // Names are claimed on every page, so a one-page export picks the same names as a full one.
  for (const page of graph.getPages()) {
    for (const group of collectGroups(graph, page)) {
      // Storybook ids ignore case and punctuation, so `Library/Card` and `library/card` collide.
      group.title = claimName(group.title, takenIds, { separator: ' ', key: storyId })
      // File names are compared ignoring case for case-insensitive file systems.
      const file = claimName(identifierName(group.name, 'Component'), takenFiles, {
        key: (name) => name.toLowerCase()
      })
      if (options.pageId && page.id !== options.pageId) continue

      const names = storyNames(group)
      const render = options.renderDesignImage
      const images = render ? names.map((name) => `${file}.design/${name}.png`) : []
      if (render) {
        for (const [i, variant] of group.variants.entries())
          add(page, images[i] ?? '', await render(variant.node.id))
      }
      const context = { ...options, graph, framework, uniqueNames, storyNames: names, images }
      add(page, `${file}.stories.ts`, storyModule(group, context))
    }
  }
  return files
}
