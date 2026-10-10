import { PLACEMENT } from '#dom-css/behaviours/states/layers'
import { tokenStylesheet } from '#dom-css/tokens/stylesheet'
import type { DesignDocument, DesignNode, DesignStyleDeclaration } from '#dom-css/types'
import { compact } from 'es-toolkit/array'
import { omit } from 'es-toolkit/object'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import {
  designFontRequests,
  fontFaceStylesheet,
  type ExportHTMLFile,
  type WebFontFaceRequest,
  type WebFontFaceResolver
} from '../bundle'
import { componentModel, type ComponentGenerator, type ComponentModel } from '../components/model'
import { reactComponent } from '../components/react'
import type { ComponentReferences } from '../components/references'
import { vueComponent } from '../components/vue'
import { serializeHTML, serializeNode } from '../html'
import { sceneNodeToDesignDocument, type VectorElementRenderer } from '../projection'
import { printComponentStories } from './component'
import { collectGroups, type StoryGroup } from './groups'
import {
  printStoryModule,
  STORYBOOK_PACKAGES,
  type StoryDesign,
  type StorybookFramework
} from './module'
import { claimName, fileTags, identifierName, storyId, VARIANT_TAG } from './names'

export { STORYBOOK_FRAMEWORKS, type StorybookFramework } from './module'

/** Frameworks whose stories render generated components; HTML stories stay static. */
const GENERATORS: Partial<Record<StorybookFramework, ComponentGenerator>> = {
  vue: vueComponent,
  react: reactComponent
}

export interface ExportStorybookOptions {
  framework?: StorybookFramework
  /** Limit the export to one page. Defaults to every page. */
  pageId?: string
  /**
   * The document's name, which titles its stories, such as `Pricing/Plan picker`, with each
   * page's name between when it has several. Without it, stories are titled by page.
   */
  document?: string
  /** Repository-relative `.fig`/`.pen` path; adds an `openpencil://` design link to stories. */
  linkPath?: string
  /** Renders a variant to PNG; each story then shows it next to the link as its design. */
  renderDesignImage?: (nodeId: string) => Promise<Uint8Array>
  /** Draws vector layers as inline SVG, from the engine's SVG export. */
  vectorElement?: VectorElementRenderer
  /**
   * How each story file is written, which a caller decides, such as from rules a user wrote:
   * which stories it has and its title. Every file is written as `variants` by default.
   */
  plan?: (target: StoryTarget) => StoryPlan
  /**
   * Finds the font files the stories' text uses, which ship with them in `fonts/` and load
   * before a story shows, so its text draws in the document's fonts. Without it, text uses
   * whatever fonts Storybook's page has.
   */
  fonts?: WebFontFaceResolver
  /**
   * The folder a document's shared files go in, its fonts and design tokens, which must differ
   * for each document exported into the same place; `openpencil/<document>` by default.
   */
  folder?: string
}

/** How a story file shows its component: every variant, Default alone, a gallery, or not. */
export const STORY_MODES = ['variants', 'single', 'gallery', 'none'] as const
export type StoryMode = (typeof STORY_MODES)[number]

/** A story file the export would write, as a plan reads it. */
export interface StoryTarget {
  /** The document's name, when the export knows it. */
  document: string | undefined
  page: string
  /** The component set's or component's name, or a slash-named group's prefix. */
  name: string
  /** The title the file has unless the plan gives another. */
  title: string
}

/** What a plan says about a story file; anything it leaves out stays as it would be. */
export interface StoryPlan {
  stories?: StoryMode
  title?: string
  /**
   * Whether a Vue or React export generates a component for the file, as it does by default,
   * or keeps static stories of its variants.
   */
  generate?: boolean
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
  vectorElement?: VectorElementRenderer
  mode: Exclude<StoryMode, 'none'>
  /** Stylesheets every story file imports, such as the fonts its text uses. */
  styles: string[]
}

function designLink(
  context: Pick<ModuleContext, 'linkPath' | 'uniqueNames'>,
  ...candidates: (string | undefined)[]
): StoryDesign[] {
  const node = candidates.find((name) => name !== undefined && context.uniqueNames.has(name))
  if (!context.linkPath || !node) return []
  const url = `openpencil://open?file=${encodeURIComponent(context.linkPath)}&node=${encodeURIComponent(node)}`
  return [{ type: 'link', url }]
}

/** Story export names, which also name the design images. */
function storyNames(group: StoryGroup): string[] {
  // Named apart from the module's own types, `Story` and `Args`.
  const taken = new Set(['story', 'args'])
  const key = (name: string) => name.toLowerCase()
  return group.variants.map((variant, index) => {
    // The first variant, the one the design shows at rest, is the file's Default story.
    const text = index === 0 || group.props.length === 0 ? 'Default' : variant.values.join(' ')
    return claimName(identifierName(text, 'Variant'), taken, { key })
  })
}

function storyLabel(group: StoryGroup, values: string[], index: number): string {
  if (index === 0 || group.props.length === 0) return 'Default'
  return group.props.map((prop, i) => `${prop.name}=${values[i] ?? ''}`).join(', ')
}

/**
 * A variant drawn on its own, as a story shows it: its root, placed nowhere in particular, hugs
 * its content where the design gives it no width, rather than filling the story's canvas, and sizes include padding and
 * borders, which no page reset around the story says.
 */
function standalone(document: DesignDocument): DesignDocument {
  const visit = (node: DesignNode, root: boolean) => {
    if (node.type !== 'element') return
    // A variant's root drops where the set places it, which is not where the story draws it,
    // and stays the containing block of the layers placed inside it.
    const placed = root && Object.hasOwn(node.inlineStyle ?? {}, 'position')
    const style: DesignStyleDeclaration = root
      ? { ...omit({ ...node.inlineStyle }, PLACEMENT), ...(placed ? { position: 'relative' } : {}) }
      : { ...node.inlineStyle }
    const has = (property: string) => Object.hasOwn(style, property)
    if ((has('width') || has('height')) && !has('box-sizing')) style['box-sizing'] = 'border-box'
    if (root && !has('width')) style.width = 'fit-content'
    node.inlineStyle = style
    for (const child of node.children) visit(child, false)
  }
  for (const child of document.children) visit(child, true)
  return document
}

function storyModule(group: StoryGroup, context: ModuleContext): string {
  return printStoryModule({
    framework: context.framework,
    title: group.title,
    tags: fileTags(group.page.name),
    styles: context.styles,
    name: group.name,
    props: group.props,
    variants: group.variants.map((variant) => ({
      values: variant.values,
      html: serializeHTML(
        standalone(
          sceneNodeToDesignDocument(context.graph, variant.node.id, {
            includeSourceIds: false,
            vectorElement: context.vectorElement
          })
        )
      )
    })),
    metaDesign: designLink(context, group.linkNode),
    images: context.images,
    gallery:
      context.mode === 'gallery'
        ? group.variants.map((variant) => ({
            values: variant.values,
            label: serializeNode({ type: 'text', text: variant.values.join(', ') || group.name })
          }))
        : null,
    stories: (context.mode === 'variants' ? group.variants : group.variants.slice(0, 1)).map(
      (variant, i) => ({
        exportName: context.storyNames[i] ?? '',
        label: storyLabel(group, variant.values, i),
        tags: i === 0 ? [] : [VARIANT_TAG],
        values: variant.values,
        design: [
          ...designLink(context, variant.node.name, group.linkNode),
          ...(context.images[i] ? [{ type: 'image' as const, variant: i }] : [])
        ]
      })
    )
  })
}

/** A story file to write: its group, the page it comes from, and its claimed file name. */
interface StoryEntry {
  page: SceneNode
  group: StoryGroup
  file: string
  mode: Exclude<StoryMode, 'none'>
  generate: boolean
}

/**
 * Every group's story file, with names claimed on every page so a one-page export picks the
 * same names as a full one, kept for the pages the export covers.
 */
function storyEntries(
  graph: SceneGraph,
  { pageId, document, plan }: Pick<ExportStorybookOptions, 'pageId' | 'document' | 'plan'>
): StoryEntry[] {
  const takenFiles = new Set<string>()
  const takenIds = new Set<string>()
  const entries: StoryEntry[] = []
  const pages = graph.getPages()
  // Pages without components, such as an empty first page, add no level to the titles.
  const storied = pages.filter((page) => collectGroups(graph, page).length > 0)
  const section = (page: SceneNode) => {
    if (document === undefined) return page.name
    return storied.length > 1 ? `${document}/${page.name}` : document
  }
  for (const page of pages) {
    for (const group of collectGroups(graph, page, section(page))) {
      const planned = plan?.({ document, page: page.name, name: group.name, title: group.title })
      const mode = planned?.stories ?? 'variants'
      if (mode === 'none') continue
      // Storybook ids ignore case and punctuation, so `Library/Card` and `library/card` collide.
      group.title = claimName(planned?.title ?? group.title, takenIds, {
        separator: ' ',
        key: storyId
      })
      // File names are compared ignoring case for case-insensitive file systems.
      const file = claimName(identifierName(group.name, 'Component'), takenFiles, {
        key: (name) => name.toLowerCase()
      })
      const generate = planned?.generate ?? true
      if (!pageId || page.id === pageId) entries.push({ page, group, file, mode, generate })
    }
  }
  return entries
}

/**
 * The component each entry's set generates, by set id, built twice: first alone, so each
 * knows its props, then knowing all the others, so an instance of one uses it rather than
 * drawing its layers.
 */
function generatedModels(
  graph: SceneGraph,
  entries: readonly StoryEntry[],
  vectorElement: VectorElementRenderer | undefined
): Map<string, ComponentModel> {
  // Components are imported by their files' names, so the two always match. A group's item
  // component gets a file of its own, named apart from every story file.
  const taken = new Set(entries.map((entry) => entry.file.toLowerCase()))
  const itemNames = new Map(
    entries.map((entry) => [
      entry.file,
      claimName(`${entry.file}Item`, taken, { key: (name) => name.toLowerCase() })
    ])
  )
  const model = (set: SceneNode, file: string, references?: ComponentReferences) =>
    componentModel(graph, set, {
      vectorElement,
      references,
      name: file,
      itemName: itemNames.get(file)
    })
  const alone = new Map<string, ComponentModel>()
  for (const { group, file, generate } of entries) {
    const component = generate && group.set && model(group.set, file)
    if (group.set && component) alone.set(group.set.id, component)
  }
  const models = new Map<string, ComponentModel>()
  for (const { group, file } of entries) {
    const component = group.set && alone.has(group.set.id) && model(group.set, file, alone)
    if (group.set && component) models.set(group.set.id, component)
  }
  return models
}

/** The folder a document's shared files go in, unless the caller names one. */
function documentFolder(graph: SceneGraph, options: ExportStorybookOptions): string {
  if (options.folder) return options.folder
  const page = options.pageId ? graph.getNode(options.pageId)?.name : undefined
  const named = compact([options.document ?? 'document', page]).map((name) => storyId(name))
  return `openpencil/${named.join('-')}`
}

/**
 * The font files the entries' text uses, and the stylesheet that loads them. Faces load
 * before text draws, so a story never shows a fallback font first.
 */
async function storyFonts(
  graph: SceneGraph,
  entries: readonly StoryEntry[],
  options: ExportStorybookOptions,
  folder: string
): Promise<ExportHTMLFile[]> {
  if (!options.fonts) return []
  const requests = new Map<string, WebFontFaceRequest>()
  for (const { group } of entries)
    for (const variant of group.variants)
      for (const request of designFontRequests(
        sceneNodeToDesignDocument(graph, variant.node.id, { includeSourceIds: false })
      ))
        requests.set(`${request.family}|${request.weight}|${request.style ?? 'normal'}`, request)
  if (requests.size === 0) return []
  const assets = await options.fonts([...requests.values()], `${folder}/fonts`)
  if (assets.length === 0) return []
  const css = await fontFaceStylesheet(assets, { from: folder, display: 'block' })
  return [...assets, { path: `${folder}/fonts.css`, content: css }]
}

/**
 * The document's design tokens as custom properties, which stories' styles refer to as
 * `var(--…)` wherever the design binds a variable, so they resolve as the design draws them.
 */
async function storyTokens(graph: SceneGraph, folder: string): Promise<ExportHTMLFile[]> {
  if (graph.variables.size === 0) return []
  const { css } = await tokenStylesheet(graph, { format: 'css' })
  return css ? [{ path: `${folder}/tokens.css`, content: css }] : []
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
  const files: StorybookFile[] = []
  const add = (page: SceneNode, path: string, content: string | Uint8Array) =>
    files.push({ path, content, page: page.name })

  const entries = storyEntries(graph, options)
  const folder = documentFolder(graph, options)
  const shared = [
    ...(await storyFonts(graph, entries, options, folder)),
    ...(await storyTokens(graph, folder))
  ]
  const firstPage = entries.at(0)?.page
  if (firstPage) for (const file of shared) add(firstPage, file.path, file.content)
  // Every story file loads the document's fonts and tokens.
  const styles = shared.filter((file) => file.path.endsWith('.css')).map((file) => `./${file.path}`)
  const generate = GENERATORS[framework]
  const models = generate ? generatedModels(graph, entries, options.vectorElement) : new Map()

  for (const { page, group, file, mode } of entries) {
    const component = group.set && models.get(group.set.id)
    if (generate && component) {
      const generated = await generate(component)
      for (const item of generated.files) add(page, item.path, item.content)
      const design = designLink({ linkPath: options.linkPath, uniqueNames }, group.linkNode)
      add(
        page,
        `${file}.stories.ts`,
        printComponentStories({
          storybook: STORYBOOK_PACKAGES[framework],
          title: group.title,
          tags: fileTags(group.page.name),
          styles,
          component,
          generated,
          // A gallery lays out static variants; a generated component's stories are its states.
          single: mode === 'single',
          design: design.flatMap((entry) =>
            entry.type === 'link' ? [{ name: 'OpenPencil', type: 'link', url: entry.url }] : []
          )
        })
      )
      continue
    }

    // Only the stories a file keeps get design images; a gallery or Default alone keeps one.
    const names = storyNames(group).slice(0, mode === 'variants' ? undefined : 1)
    const render = options.renderDesignImage
    const images = render ? names.map((name) => `${file}.design/${name}.png`) : []
    if (render) {
      for (const [i, variant] of group.variants.slice(0, names.length).entries())
        add(page, images[i] ?? '', await render(variant.node.id))
    }
    const context = {
      ...options,
      graph,
      framework,
      uniqueNames,
      storyNames: names,
      images,
      mode,
      styles
    }
    add(page, `${file}.stories.ts`, storyModule(group, context))
  }
  return files
}
